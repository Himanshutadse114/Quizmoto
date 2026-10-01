const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

process.env.NODE_ENV = 'test';

const { sequelize } = require('../config/database');
const UserTemplate = require('../models/scorm/ScormAwarenessUserTemplate');
const Campaign = require('../models/scorm/ScormAwarenessEmailCampaign');
const Recipient = require('../models/scorm/ScormAwarenessEmailCampaignRecipient');
const realBatch = require('../services/mail/MailBatchDeliveryService');
const RealService = require('../services/awareness/AwarenessEmailCampaignService');
let deliveredHtml = [];

function immediateBatch(items, sender, input = {}, options = {}) {
    return (async () => {
        const plan = realBatch.deliveryPlan(items.length, input);
        const results = [];
        for (let i = 0; i < items.length; i += 1) {
            if (options.shouldContinue && !(await options.shouldContinue({ batchIndex: 0, itemIndex: i, plan }))) break;
            results.push(await sender(items[i], { batchIndex: 0, itemIndex: i, plan }));
        }
        return { plan, results };
    })();
}

const DeliveryService = proxyquire('../services/awareness/AwarenessEmailCampaignService', {
    '../mail/MailBatchDeliveryService': {
        ...realBatch,
        sendInBatches: immediateBatch,
        runInBackground: () => {}
    },
    '../mail/MailService': {
        isConfigured: () => true,
        mailProvider: () => 'smtp'
    },
    './AwarenessMailDeliveryService': {
        sendContent: async ({ to, html }) => {
            deliveredHtml.push(html);
            return {
                sent: true,
                state: 'accepted',
                provider: 'smtp',
                messageId: '<' + to + '>',
                accepted: [to],
                rejected: []
            };
        }
    },
    './AwarenessTemplateGalleryService': {
        smtpEmbedImages: () => false,
        toText: () => 'Campaign email',
        inlineAssets: async (html) => ({ html, attachments: [] })
    }
});

describe('AwarenessEmailCampaignService', function () {
    this.timeout(30000);

    before(async () => {
        await sequelize.sync({ force: true });
        await UserTemplate.create({
            id: '11111111-1111-4111-8111-111111111111',
            hostId: 42,
            createdByUserId: 42,
            centralTemplateId: null,
            title: 'Security Update',
            subject: 'Security update for employees',
            htmlContent: '<html><body><h1>Security update</h1></body></html>',
            userAssetManifestJson: '[]',
            publicAssetToken: 'a'.repeat(64),
            status: 'ready'
        });
    });

    beforeEach(() => {
        deliveredHtml = [];
    });

    it('creates a draft campaign from a My Library template and CSV recipients', async () => {
        const result = await RealService.createCampaign({
            hostId: 42,
            createdByUserId: 42,
            name: 'September Awareness',
            userTemplateId: '11111111-1111-4111-8111-111111111111',
            csvText: 'Email,Name\none@example.com,One\ntwo@example.com,Two\n',
            mailBatchSize: 1,
            mailBatchDelaySeconds: 15
        });

        expect(result.campaign.status).to.equal('draft');
        expect(result.campaign.templateTitle).to.equal('Security Update');
        expect(result.campaign.recipientCount).to.equal(2);
        expect(result.campaign.delivery.batchCount).to.equal(2);
        expect(result.campaign.delivery.batchSize).to.equal(1);
        expect(await Recipient.count({ where: { campaignId: result.campaign.id } })).to.equal(2);
    });

    it('refuses templates that do not belong to the tenant My Library', async () => {
        let error;
        try {
            await RealService.createCampaign({
                hostId: 99,
                name: 'Wrong tenant',
                userTemplateId: '11111111-1111-4111-8111-111111111111',
                csvText: 'Email,Name\nuser@example.com,User\n'
            });
        } catch (caught) {
            error = caught;
        }
        expect(error).to.exist;
        expect(error.code).to.equal('AWARENESS_EMAIL_CAMPAIGN_TEMPLATE_REQUIRED');
    });

    it('requires a unique campaign name within the same workspace', async () => {
        await RealService.createCampaign({
            hostId: 42,
            createdByUserId: 42,
            name: 'Unique Campaign Name',
            userTemplateId: '11111111-1111-4111-8111-111111111111',
            csvText: 'Email,Name\nfirst@example.com,First\n'
        });

        let error;
        try {
            await RealService.createCampaign({
                hostId: 42,
                createdByUserId: 42,
                name: '  unique campaign name  ',
                userTemplateId: '11111111-1111-4111-8111-111111111111',
                csvText: 'Email,Name\nsecond@example.com,Second\n'
            });
        } catch (caught) {
            error = caught;
        }

        expect(error).to.exist;
        expect(error.code).to.equal('AWARENESS_EMAIL_CAMPAIGN_NAME_EXISTS');
        expect(error.status).to.equal(409);
    });

    it('starts a draft and records accepted recipients as completed delivery', async () => {
        const created = await RealService.createCampaign({
            hostId: 42,
            createdByUserId: 42,
            name: 'Immediate Delivery',
            userTemplateId: '11111111-1111-4111-8111-111111111111',
            csvText: 'Email,Name\nalpha@example.com,Alpha\nbeta@example.com,Beta\n',
            mailBatchCount: 2,
            mailBatchDelaySeconds: 15
        });

        const started = await DeliveryService.startCampaign(created.campaign.id, 42);
        expect(started.status).to.equal('sending');

        await DeliveryService.deliverCampaign(created.campaign.id);

        const completed = await RealService.getCampaign(created.campaign.id, 42, { includeRecipients: true });
        expect(completed.status).to.equal('completed');
        expect(completed.sentCount).to.equal(2);
        expect(completed.failedCount).to.equal(0);
        expect(completed.recipients.every((item) => item.status === 'sent')).to.equal(true);
        expect(completed).not.to.have.property('openedCount');
        expect(completed.recipients.every((item) => !Object.hasOwn(item, 'openCount'))).to.equal(true);
        expect(deliveredHtml).to.have.length(2);
        expect(deliveredHtml.every((html) => !String(html).includes('/track/open/'))).to.equal(true);
    });

    it('allows a sending campaign to be stopped and then deleted', async () => {
        const created = await RealService.createCampaign({
            hostId: 42,
            createdByUserId: 42,
            name: 'Stop Me',
            userTemplateId: '11111111-1111-4111-8111-111111111111',
            csvText: 'Email,Name\nstop@example.com,Stop\n'
        });

        await DeliveryService.startCampaign(created.campaign.id, 42);
        const stopped = await RealService.stopCampaign(created.campaign.id, 42);
        expect(stopped.status).to.equal('stopped');

        const removed = await RealService.deleteCampaign(created.campaign.id, 42);
        expect(removed.removed).to.equal(true);
        expect(await Campaign.count({ where: { id: created.campaign.id } })).to.equal(0);
    });

    it('allows a completed campaign to be deleted', async () => {
        const created = await DeliveryService.createCampaign({
            hostId: 42,
            createdByUserId: 42,
            name: 'Completed Campaign Delete',
            userTemplateId: '11111111-1111-4111-8111-111111111111',
            csvText: 'Email,Name\ncomplete@example.com,Complete\n'
        });

        await DeliveryService.startCampaign(created.campaign.id, 42);
        await DeliveryService.deliverCampaign(created.campaign.id);
        const completed = await Campaign.findByPk(created.campaign.id);
        expect(completed.status).to.equal('completed');

        const removed = await RealService.deleteCampaign(created.campaign.id, 42);
        expect(removed.removed).to.equal(true);
        expect(await Campaign.count({ where: { id: created.campaign.id } })).to.equal(0);
    });
});
