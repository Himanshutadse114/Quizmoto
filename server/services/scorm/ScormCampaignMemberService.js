const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const User = require('../../models/User');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormCampaignCourse,
    ScormCourse,
    ScormRegistration,
    ScormLearnerRoster
} = require('../../models/scorm');
const { getAccessRole } = require('./ScormAccessService');
const { getEntitlement } = require('./ScormEntitlementService');
const {
    normalizeStoredAuthMode,
    campaignAccessCode
} = require('./ScormCampaignAuthPolicy');
const MailService = require('../mail/MailService');
const { getCampaignManageDetail } = require('./ScormCampaignReadService');

const MAX_CAMPAIGN_COMBINATIONS = 5000;
const ACTIVE_REGISTRATION_STATUSES = { [Op.notIn]: ['revoked', 'superseded'] };
const CAMPAIGN_PUBLIC_BASE_URL = String(
    process.env.CAMPAIGN_PUBLIC_BASE_URL || 'https://www.lmsgen.in'
).trim().replace(/\/+$/, '') || 'https://www.lmsgen.in';

function fail(message, code, status = 400) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function campaignPublicUrl(campaignId) {
    return `${CAMPAIGN_PUBLIC_BASE_URL}/campaign/${encodeURIComponent(String(campaignId || ''))}`;
}

function normalizeLearners(input) {
    if (!Array.isArray(input)) return [];
    const seen = new Set();
    const learners = [];
    for (const raw of input.slice(0, 500)) {
        const email = normalizeEmail(raw?.email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
        seen.add(email);
        const learnerName = String(raw?.learnerName || raw?.name || '').trim().slice(0, 180) || email.split('@')[0];
        learners.push({ email, learnerName });
    }
    return learners;
}

async function activeCampaign({ campaignId, hostId, workspaceId, transaction = null, lock = false }) {
    const options = {
        where: { id: campaignId, hostId, workspaceId },
        transaction
    };
    if (lock && transaction) options.lock = transaction.LOCK.UPDATE;
    const campaign = await ScormCampaign.findOne(options);
    if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);
    if (campaign.status !== 'active') {
        throw fail('Learners can only be changed while the campaign is active.', 'SCORM_CAMPAIGN_NOT_ACTIVE', 409);
    }
    return campaign;
}

async function assertLearnerLimit(hostId, emails) {
    const host = await User.findByPk(hostId);
    if (!host?.email) return;
    const role = await getAccessRole(host.email);
    const entitlement = await getEntitlement(host.email, role || 'admin');
    const maxLearners = entitlement?.maxLearners;
    if (maxLearners === null || maxLearners === undefined) return;

    const courses = await ScormCourse.findAll({ where: { hostId }, attributes: ['id'], raw: true });
    const courseIds = courses.map((course) => course.id);
    const existingRows = courseIds.length ? await ScormRegistration.findAll({
        where: {
            courseId: { [Op.in]: courseIds },
            isPreview: false,
            status: ACTIVE_REGISTRATION_STATUSES,
            learnerEmail: { [Op.ne]: null }
        },
        attributes: ['learnerEmail'],
        raw: true
    }) : [];
    const enrolled = new Set(existingRows.map((row) => normalizeEmail(row.learnerEmail)).filter(Boolean));
    const requested = [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];
    const additional = requested.filter((email) => !enrolled.has(email)).length;
    if (enrolled.size + additional > Number(maxLearners)) {
        throw fail(`Adding these learners would exceed the workspace learner limit (${enrolled.size + additional}/${maxLearners}).`, 'SCORM_LEARNER_LIMIT_REACHED', 403);
    }
}

function registrationCompleted(registration) {
    const lesson = String(registration?.lastLessonStatus || '').trim().toLowerCase();
    return registration?.status === 'completed' || ['completed', 'passed', 'failed'].includes(lesson);
}

async function sendCampaignMail(campaign, learner, template) {
    // Do not trust a stale campaign instance when generating a learner link.
    // Re-read the row so invitations/reminders can never be sent for a stopped
    // or otherwise inactive campaign.
    const liveCampaign = await ScormCampaign.findByPk(campaign.id);
    if (!liveCampaign || String(liveCampaign.status).toLowerCase() !== 'active') {
        return { sent: false, skipped: true, reason: 'SCORM_CAMPAIGN_NOT_ACTIVE' };
    }

    const mode = normalizeStoredAuthMode(liveCampaign.authMode);
    return MailService.safeSend({
        to: learner.email,
        template,
        data: {
            learnerName: learner.learnerName,
            campaignId: liveCampaign.id,
            campaignName: liveCampaign.name,
            dueAt: liveCampaign.dueAt,
            accessCode: mode === 'email_code' ? campaignAccessCode(liveCampaign.id, learner.email) : null,
            path: campaignPublicUrl(liveCampaign.id)
        }
    });
}

async function addLearners({ campaignId, hostId, workspaceId, actorUserId, learners }) {
    const requested = normalizeLearners(learners);
    if (!requested.length) {
        throw fail('Add at least one valid learner email address.', 'SCORM_CAMPAIGN_LEARNER_REQUIRED', 400);
    }

    await activeCampaign({ campaignId, hostId, workspaceId });
    const existingRows = await ScormCampaignLearner.findAll({
        where: { campaignId, email: { [Op.in]: requested.map((learner) => learner.email) } },
        attributes: ['email'],
        raw: true
    });
    const existing = new Set(existingRows.map((row) => normalizeEmail(row.email)));
    const additions = requested.filter((learner) => !existing.has(learner.email));
    if (!additions.length) {
        return {
            added: 0,
            existing: requested.length,
            invitationSent: 0,
            campaign: await getCampaignManageDetail({ campaignId, hostId, workspaceId })
        };
    }

    await assertLearnerLimit(hostId, additions.map((learner) => learner.email));

    let campaign;
    await sequelize.transaction(async (transaction) => {
        campaign = await activeCampaign({ campaignId, hostId, workspaceId, transaction, lock: true });
        const courseLinks = await ScormCampaignCourse.findAll({ where: { campaignId }, transaction });
        if (!courseLinks.length) throw fail('Campaign has no courses.', 'SCORM_CAMPAIGN_EMPTY', 409);

        const currentLearnerCount = await ScormCampaignLearner.count({ where: { campaignId }, transaction });
        if ((currentLearnerCount + additions.length) * courseLinks.length > MAX_CAMPAIGN_COMBINATIONS) {
            throw fail(`A campaign can contain at most ${MAX_CAMPAIGN_COMBINATIONS} learner-course instances.`, 'SCORM_CAMPAIGN_TOO_LARGE', 413);
        }

        const courses = await ScormCourse.findAll({
            where: { id: { [Op.in]: courseLinks.map((link) => link.courseId) }, hostId, status: 'published' },
            transaction
        });
        if (courses.length !== courseLinks.length) {
            throw fail('One or more campaign courses are no longer published.', 'SCORM_CAMPAIGN_COURSE_NOT_PUBLISHED', 409);
        }

        await ScormCampaignLearner.bulkCreate(additions.map((learner) => ({
            campaignId,
            email: learner.email,
            learnerName: learner.learnerName
        })), { transaction });

        const now = new Date();
        const registrations = [];
        for (const learner of additions) {
            const [roster] = await ScormLearnerRoster.findOrCreate({
                where: { hostId, email: learner.email },
                defaults: { hostId, email: learner.email, learnerName: learner.learnerName },
                transaction
            });
            if (!roster.learnerName && learner.learnerName) {
                roster.learnerName = learner.learnerName;
                await roster.save({ transaction });
            }
            for (const course of courses) {
                registrations.push({
                    courseId: course.id,
                    campaignId,
                    learnerEmail: learner.email,
                    learnerName: learner.learnerName,
                    status: 'invited',
                    isPreview: false,
                    assignedAt: now,
                    assignedByUserId: actorUserId || hostId,
                    dueAt: campaign.dueAt || null,
                    assignmentSource: 'campaign',
                    required: campaign.required !== false
                });
            }
        }
        await ScormRegistration.bulkCreate(registrations, { transaction });
    });

    let invitationSent = 0;
    for (let index = 0; index < additions.length; index += 10) {
        const batch = additions.slice(index, index + 10);
        const results = await Promise.all(batch.map((learner) => sendCampaignMail(campaign, learner, 'campaign_invitation')));
        invitationSent += results.filter((result) => result?.sent).length;
    }

    return {
        added: additions.length,
        existing: requested.length - additions.length,
        invitationSent,
        campaign: await getCampaignManageDetail({ campaignId, hostId, workspaceId })
    };
}

async function removeLearner({ campaignId, hostId, workspaceId, email }) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) throw fail('Learner email is required.', 'SCORM_CAMPAIGN_LEARNER_REQUIRED', 400);

    let removed = false;
    await sequelize.transaction(async (transaction) => {
        await activeCampaign({ campaignId, hostId, workspaceId, transaction, lock: true });
        const learner = await ScormCampaignLearner.findOne({
            where: { campaignId, email: cleanEmail },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!learner) throw fail('Learner is not part of this campaign.', 'SCORM_CAMPAIGN_LEARNER_NOT_FOUND', 404);

        await ScormRegistration.update({ status: 'revoked' }, {
            where: {
                campaignId,
                learnerEmail: cleanEmail,
                isPreview: false,
                status: ACTIVE_REGISTRATION_STATUSES
            },
            transaction
        });
        await learner.destroy({ transaction });
        removed = true;
    });

    return {
        removed,
        email: cleanEmail,
        campaign: await getCampaignManageDetail({ campaignId, hostId, workspaceId })
    };
}

async function sendReminders({ campaignId, hostId, workspaceId, emails = [] }) {
    const campaign = await activeCampaign({ campaignId, hostId, workspaceId });
    const requested = new Set((Array.isArray(emails) ? emails : []).map(normalizeEmail).filter(Boolean));
    const learners = await ScormCampaignLearner.findAll({
        where: {
            campaignId,
            ...(requested.size ? { email: { [Op.in]: [...requested] } } : {})
        },
        attributes: ['email', 'learnerName'],
        order: [['learnerName', 'ASC'], ['email', 'ASC']]
    });
    const registrations = await ScormRegistration.findAll({
        where: {
            campaignId,
            isPreview: false,
            status: ACTIVE_REGISTRATION_STATUSES,
            ...(learners.length ? { learnerEmail: { [Op.in]: learners.map((learner) => learner.email) } } : {})
        },
        attributes: ['learnerEmail', 'status', 'lastLessonStatus'],
        raw: true
    });

    const byEmail = new Map();
    for (const registration of registrations) {
        const key = normalizeEmail(registration.learnerEmail);
        if (!byEmail.has(key)) byEmail.set(key, []);
        byEmail.get(key).push(registration);
    }

    const targets = learners.filter((learner) => {
        const rows = byEmail.get(normalizeEmail(learner.email)) || [];
        return rows.length > 0 && rows.some((registration) => !registrationCompleted(registration));
    });
    const skippedCompleted = learners.length - targets.length;

    let sent = 0;
    let failed = 0;
    const failures = [];
    for (let index = 0; index < targets.length; index += 10) {
        const batch = targets.slice(index, index + 10);
        const results = await Promise.all(batch.map(async (learner) => ({
            learner,
            result: await sendCampaignMail(campaign, learner, 'campaign_reminder')
        })));
        for (const item of results) {
            if (item.result?.sent) sent += 1;
            else {
                failed += 1;
                failures.push({ email: item.learner.email, reason: item.result?.reason || 'MAIL_SEND_FAILED' });
            }
        }
    }

    return {
        targeted: targets.length,
        sent,
        failed,
        skippedCompleted,
        failures: failures.slice(0, 50)
    };
}

module.exports = {
    addLearners,
    removeLearner,
    sendReminders,
    normalizeLearners,
    registrationCompleted,
    campaignPublicUrl
};
