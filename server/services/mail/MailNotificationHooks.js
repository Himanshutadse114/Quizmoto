const logger = require('../../utils/logger');
const MailService = require('./MailService');
const {
    normalizeStoredAuthMode,
    campaignAccessCode
} = require('../scorm/ScormCampaignAuthPolicy');

let registered = false;

function runLater(options, task) {
    const execute = () => {
        setImmediate(() => {
            Promise.resolve()
                .then(task)
                .catch((error) => logger.error('mail_notification_hook_failed', {
                    module: 'mail',
                    error: error.message,
                    code: error.code
                }));
        });
    };
    if (options?.transaction && typeof options.transaction.afterCommit === 'function') {
        options.transaction.afterCommit(execute);
    } else {
        execute();
    }
}

async function sendInBatches(items, sender, batchSize = 10) {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map((item) => sender(item)));
    }
}

function register(models = {}) {
    if (registered) return;
    const {
        ScormRegistration,
        ScormCourse,
        ScormWorkspace,
        ScormWorkspaceMember,
        ScormCampaign,
        ScormCampaignLearner,
        ScormAccessRequest
    } = models;

    if (!ScormRegistration || !ScormCourse || !ScormWorkspace || !ScormWorkspaceMember || !ScormCampaign || !ScormCampaignLearner || !ScormAccessRequest) {
        logger.warn('mail_notification_hooks_skipped', { module: 'mail', reason: 'models_missing' });
        return;
    }

    registered = true;

    ScormRegistration.addHook('afterCreate', 'mail-course-assignment', (registration, options) => {
        if (registration.isPreview || registration.campaignId || !registration.learnerEmail) return;
        runLater(options, async () => {
            const course = await ScormCourse.findByPk(registration.courseId);
            if (!course || course.status !== 'published') return;
            await MailService.safeSend({
                to: registration.learnerEmail,
                template: 'course_assignment',
                data: {
                    learnerName: registration.learnerName,
                    courseTitle: course.title,
                    dueAt: registration.dueAt,
                    path: '/learn'
                }
            });
        });
    });

    ScormCampaign.addHook('afterUpdate', 'mail-campaign-started', (campaign, options) => {
        if (!campaign.changed('status') || String(campaign.status).toLowerCase() !== 'active') return;
        runLater(options, async () => {
            const learners = await ScormCampaignLearner.findAll({ where: { campaignId: campaign.id } });
            const authMode = normalizeStoredAuthMode(campaign.authMode);
            await sendInBatches(learners, async (learner) => MailService.safeSend({
                to: learner.email,
                template: 'campaign_invitation',
                data: {
                    learnerName: learner.learnerName,
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    dueAt: campaign.dueAt,
                    accessCode: authMode === 'email_code' ? campaignAccessCode(campaign.id, learner.email) : null,
                    path: `/campaign/${encodeURIComponent(campaign.id)}`
                }
            }));
        });
    });

    ScormWorkspaceMember.addHook('afterCreate', 'mail-workspace-member-invite', (member, options) => {
        const email = String(member.email || '').trim().toLowerCase();
        const superAdminEmail = String(process.env.SCORM_SUPER_ADMIN_EMAIL || 'tadsehimanshu@gmail.com').trim().toLowerCase();
        if (!email || email === superAdminEmail || email.endsWith('@lmsgen.internal')) return;
        runLater(options, async () => {
            const workspace = await ScormWorkspace.findByPk(member.workspaceId);
            if (!workspace) return;
            const role = String(member.role || '').toLowerCase();
            await MailService.safeSend({
                to: email,
                template: role === 'admin' ? 'tenant_admin_invitation' : 'team_invitation',
                data: {
                    email,
                    displayName: member.displayName,
                    role,
                    workspaceName: workspace.name
                }
            });
        });
    });

    ScormAccessRequest.addHook('afterCreate', 'mail-access-request-created', (request, options) => {
        if (String(request.status || '').toLowerCase() !== 'pending') return;
        runLater(options, async () => {
            const adminTo = MailService.adminRecipient();
            await Promise.all([
                MailService.safeSend({
                    to: request.email,
                    template: 'access_request_received',
                    data: { name: request.username, email: request.email }
                }),
                adminTo ? MailService.safeSend({
                    to: adminTo,
                    template: 'access_request_admin',
                    data: {
                        email: request.email,
                        username: request.username,
                        authMethod: request.authMethod
                    }
                }) : Promise.resolve({ sent: false, skipped: true, reason: 'MAIL_ADMIN_TO_MISSING' })
            ]);
        });
    });

    ScormAccessRequest.addHook('afterUpdate', 'mail-access-request-status', (request, options) => {
        if (!request.changed('status')) return;
        const status = String(request.status || '').toLowerCase();
        if (!['approved', 'pending'].includes(status)) return;
        runLater(options, async () => {
            await MailService.safeSend({
                to: request.email,
                template: status === 'approved' ? 'access_approved' : 'access_revoked',
                data: { name: request.username, email: request.email }
            });
        });
    });

    logger.info('mail_notification_hooks_registered', { module: 'mail' });
}

module.exports = { register };
