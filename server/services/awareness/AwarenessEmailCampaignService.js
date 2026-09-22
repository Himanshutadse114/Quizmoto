'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const logger = require('../../utils/logger');
const Campaign = require('../../models/scorm/ScormAwarenessEmailCampaign');
const Recipient = require('../../models/scorm/ScormAwarenessEmailCampaignRecipient');
const UserTemplate = require('../../models/scorm/ScormAwarenessUserTemplate');
const ScormLearnerRoster = require('../../models/scorm/ScormLearnerRoster');
const { parseCampaignCsv } = require('../scorm/ScormCampaignCsvService');
const { deliveryPlan, sendInBatches, runInBackground } = require('../mail/MailBatchDeliveryService');
const MailService = require('../mail/MailService');
const Delivery = require('./AwarenessMailDeliveryService');
const Gallery = require('./AwarenessTemplateGalleryService');

const MAX_RECIPIENTS = 5000;
let schemaPromise = null;

function fail(message, code, status = 400) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}

function clean(value, max = 1000) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

async function ensureSchema() {
    if (!schemaPromise) {
        schemaPromise = Promise.all([Campaign.sync(), Recipient.sync()]).catch((error) => {
            schemaPromise = null;
            throw error;
        });
    }
    return schemaPromise;
}

function campaignSummary(row) {
    const recipientCount = Number(row.recipientCount || 0);
    const sentCount = Number(row.sentCount || 0);
    const failedCount = Number(row.failedCount || 0);
    const pendingCount = Math.max(0, recipientCount - sentCount - failedCount);
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        userTemplateId: row.userTemplateId,
        templateTitle: row.templateTitle,
        recipientCount,
        sentCount,
        failedCount,
        pendingCount,
        delivery: deliveryPlan(recipientCount, {
            batchCount: row.mailBatchCount,
            delaySeconds: row.mailBatchDelaySeconds
        }),
        startedAt: row.startedAt || null,
        endedAt: row.endedAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastError: row.lastError || null
    };
}

async function listCampaigns(hostId) {
    await ensureSchema();
    const rows = await Campaign.findAll({
        where: { hostId },
        order: [['createdAt', 'DESC']]
    });
    return rows.map(campaignSummary);
}

async function getCampaign(id, hostId, { includeRecipients = false } = {}) {
    await ensureSchema();
    const row = await Campaign.findOne({ where: { id, hostId } });
    if (!row) throw fail('Email campaign not found.', 'AWARENESS_EMAIL_CAMPAIGN_NOT_FOUND', 404);
    const result = campaignSummary(row);
    if (includeRecipients) {
        const recipients = await Recipient.findAll({
            where: { campaignId: row.id },
            order: [['learnerName', 'ASC'], ['email', 'ASC']]
        });
        result.recipients = recipients.map((item) => ({
            id: item.id,
            email: item.email,
            learnerName: item.learnerName || null,
            status: item.status,
            provider: item.provider || null,
            messageId: item.messageId || null,
            errorCode: item.errorCode || null,
            sentAt: item.sentAt || null
        }));
    }
    return result;
}

function previewCsv(csvText) {
    const parsed = parseCampaignCsv(csvText);
    return {
        validLearners: parsed.learners.length,
        totalRows: parsed.totalRows,
        invalidRows: parsed.invalidRows,
        learners: parsed.learners.slice(0, 100)
    };
}

async function createCampaign({
    hostId,
    createdByUserId = null,
    name,
    userTemplateId,
    csvText,
    mailBatchCount,
    mailBatchDelaySeconds
}) {
    await ensureSchema();
    const campaignName = clean(name, 180);
    if (campaignName.length < 2) throw fail('Enter a campaign name.', 'AWARENESS_EMAIL_CAMPAIGN_NAME_REQUIRED');
    const template = await UserTemplate.findOne({ where: { id: userTemplateId, hostId } });
    if (!template) throw fail('Choose a template from My Library.', 'AWARENESS_EMAIL_CAMPAIGN_TEMPLATE_REQUIRED', 404);

    const parsed = parseCampaignCsv(csvText);
    if (parsed.learners.length > MAX_RECIPIENTS) {
        throw fail(`An email campaign can contain up to ${MAX_RECIPIENTS} recipients.`, 'AWARENESS_EMAIL_CAMPAIGN_TOO_LARGE', 413);
    }
    const plan = deliveryPlan(parsed.learners.length, {
        batchCount: mailBatchCount,
        delaySeconds: mailBatchDelaySeconds
    });

    let campaign;
    await sequelize.transaction(async (transaction) => {
        campaign = await Campaign.create({
            hostId,
            createdByUserId,
            userTemplateId: template.id,
            name: campaignName,
            templateTitle: template.title,
            status: 'draft',
            mailBatchCount: plan.batchCount,
            mailBatchDelaySeconds: plan.delaySeconds,
            recipientCount: parsed.learners.length,
            sentCount: 0,
            failedCount: 0
        }, { transaction });

        await Recipient.bulkCreate(parsed.learners.map((learner) => ({
            campaignId: campaign.id,
            email: learner.email,
            learnerName: learner.learnerName,
            status: 'pending'
        })), { transaction });

        for (const learner of parsed.learners) {
            const [roster] = await ScormLearnerRoster.findOrCreate({
                where: { hostId, email: learner.email },
                defaults: { hostId, email: learner.email, learnerName: learner.learnerName },
                transaction
            });
            if (!roster.learnerName && learner.learnerName) {
                roster.learnerName = learner.learnerName;
                await roster.save({ transaction });
            }
        }
    });

    return {
        campaign: campaignSummary(campaign),
        csv: {
            validLearners: parsed.learners.length,
            invalidRows: parsed.invalidRows,
            totalRows: parsed.totalRows
        }
    };
}

async function deliverCampaign(campaignId) {
    await ensureSchema();
    let campaign = await Campaign.findByPk(campaignId);
    if (!campaign || campaign.status !== 'sending') return;

    try {
        const recipients = await Recipient.findAll({
            where: { campaignId, status: 'pending' },
            order: [['createdAt', 'ASC']]
        });
        if (!recipients.length) {
            campaign.status = 'completed';
            campaign.endedAt = new Date();
            await campaign.save();
            return;
        }

        const smtp = MailService.mailProvider() === 'smtp';
        const embed = smtp && Gallery.smtpEmbedImages();
        const prepared = embed
            ? await Gallery.inlineAssets(campaign.htmlSnapshot)
            : { html: campaign.htmlSnapshot, attachments: [] };
        const text = Gallery.toText(campaign.htmlSnapshot);

        await sendInBatches(
            recipients,
            async (recipient) => {
                try {
                    const result = await Delivery.sendContent({
                        to: recipient.email,
                        subject: campaign.subjectSnapshot,
                        html: prepared.html,
                        text,
                        attachments: prepared.attachments,
                        headers: {
                            'X-LMSGEN-Content-Type': 'awareness-email-campaign',
                            'X-LMSGEN-Campaign-ID': campaign.id
                        }
                    });
                    recipient.status = 'sent';
                    recipient.provider = result.provider || MailService.mailProvider();
                    recipient.messageId = result.messageId || null;
                    recipient.providerResponse = result.providerResponse || null;
                    recipient.errorCode = null;
                    recipient.sentAt = new Date();
                    await recipient.save();
                    return { sent: true, email: recipient.email };
                } catch (error) {
                    recipient.status = 'failed';
                    recipient.provider = error.provider || MailService.mailProvider();
                    recipient.providerResponse = error.providerResponse || null;
                    recipient.errorCode = error.code || 'MAIL_SEND_FAILED';
                    await recipient.save();
                    logger.error('awareness_email_campaign_recipient_failed', {
                        module: 'awareness-email-campaign',
                        campaignId,
                        email: recipient.email,
                        code: error.code || null,
                        error: error.message
                    });
                    return { sent: false, email: recipient.email, reason: error.code || 'MAIL_SEND_FAILED' };
                }
            },
            {
                batchCount: campaign.mailBatchCount,
                delaySeconds: campaign.mailBatchDelaySeconds
            },
            {
                context: { campaignId },
                shouldContinue: async () => {
                    const current = await Campaign.findByPk(campaignId, { attributes: ['status'] });
                    return current?.status === 'sending';
                }
            }
        );

        campaign = await Campaign.findByPk(campaignId);
        if (!campaign || campaign.status === 'stopped') return;
        const [sentCount, failedCount, pendingCount] = await Promise.all([
            Recipient.count({ where: { campaignId, status: 'sent' } }),
            Recipient.count({ where: { campaignId, status: 'failed' } }),
            Recipient.count({ where: { campaignId, status: 'pending' } })
        ]);
        campaign.sentCount = sentCount;
        campaign.failedCount = failedCount;
        campaign.endedAt = new Date();
        if (pendingCount > 0) campaign.status = 'stopped';
        else if (failedCount === 0) campaign.status = 'completed';
        else if (sentCount > 0) campaign.status = 'partial';
        else campaign.status = 'failed';
        await campaign.save();
    } catch (error) {
        campaign = await Campaign.findByPk(campaignId);
        if (campaign && campaign.status === 'sending') {
            campaign.status = 'failed';
            campaign.lastError = clean(error.message, 2000);
            campaign.endedAt = new Date();
            await campaign.save();
        }
        logger.error('awareness_email_campaign_failed', {
            module: 'awareness-email-campaign',
            campaignId,
            code: error.code || null,
            error: error.message
        });
    }
}

async function startCampaign(id, hostId) {
    await ensureSchema();
    if (!MailService.isConfigured()) {
        throw fail('Outbound email is not configured. Verify SMTP or Brevo before starting the campaign.', 'MAIL_NOT_CONFIGURED', 503);
    }

    let campaign;
    await sequelize.transaction(async (transaction) => {
        campaign = await Campaign.findOne({
            where: { id, hostId },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!campaign) throw fail('Email campaign not found.', 'AWARENESS_EMAIL_CAMPAIGN_NOT_FOUND', 404);
        if (campaign.status !== 'draft') {
            throw fail('Only a draft email campaign can be started.', 'AWARENESS_EMAIL_CAMPAIGN_NOT_DRAFT', 409);
        }
        const template = await UserTemplate.findOne({
            where: { id: campaign.userTemplateId, hostId },
            transaction
        });
        if (!template) {
            throw fail('The My Library template used by this campaign is no longer available.', 'AWARENESS_EMAIL_CAMPAIGN_TEMPLATE_MISSING', 409);
        }
        const recipientCount = await Recipient.count({ where: { campaignId: campaign.id }, transaction });
        if (!recipientCount) throw fail('Add at least one recipient before starting the campaign.', 'AWARENESS_EMAIL_CAMPAIGN_EMPTY', 409);

        campaign.templateTitle = template.title;
        campaign.subjectSnapshot = template.subject;
        campaign.htmlSnapshot = template.htmlContent;
        campaign.status = 'sending';
        campaign.sentCount = 0;
        campaign.failedCount = 0;
        campaign.startedAt = new Date();
        campaign.endedAt = null;
        campaign.lastError = null;
        await campaign.save({ transaction });
    });

    runInBackground(
        () => deliverCampaign(campaign.id),
        { module: 'awareness-email-campaign', campaignId: campaign.id }
    );
    return campaignSummary(campaign);
}

async function stopCampaign(id, hostId) {
    await ensureSchema();
    const campaign = await Campaign.findOne({ where: { id, hostId } });
    if (!campaign) throw fail('Email campaign not found.', 'AWARENESS_EMAIL_CAMPAIGN_NOT_FOUND', 404);
    if (campaign.status !== 'sending') {
        throw fail('Only a sending email campaign can be stopped.', 'AWARENESS_EMAIL_CAMPAIGN_NOT_SENDING', 409);
    }
    campaign.status = 'stopped';
    campaign.endedAt = new Date();
    await campaign.save();
    return campaignSummary(campaign);
}

async function deleteCampaign(id, hostId) {
    await ensureSchema();
    const campaign = await Campaign.findOne({ where: { id, hostId } });
    if (!campaign) throw fail('Email campaign not found.', 'AWARENESS_EMAIL_CAMPAIGN_NOT_FOUND', 404);
    if (!['draft', 'stopped'].includes(campaign.status)) {
        throw fail('Only draft or stopped email campaigns can be deleted.', 'AWARENESS_EMAIL_CAMPAIGN_DELETE_FORBIDDEN', 409);
    }
    await sequelize.transaction(async (transaction) => {
        await Recipient.destroy({ where: { campaignId: campaign.id }, transaction });
        await campaign.destroy({ transaction });
    });
    return { removed: true, id };
}

async function activeCampaignCountForTemplate(userTemplateId, hostId) {
    await ensureSchema();
    return Campaign.count({
        where: {
            hostId,
            userTemplateId,
            status: { [Op.in]: ['draft', 'sending'] }
        }
    });
}

module.exports = {
    MAX_RECIPIENTS,
    ensureSchema,
    previewCsv,
    listCampaigns,
    getCampaign,
    createCampaign,
    startCampaign,
    stopCampaign,
    deleteCampaign,
    deliverCampaign,
    activeCampaignCountForTemplate,
    campaignSummary
};
