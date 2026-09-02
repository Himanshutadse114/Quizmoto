const logger = require('../../utils/logger');
const MailService = require('./MailService');
const {
    normalizeStoredAuthMode,
    campaignAccessCode
} = require('../scorm/ScormCampaignAuthPolicy');

const CAMPAIGN_PUBLIC_BASE_URL = String(
    process.env.CAMPAIGN_PUBLIC_BASE_URL || 'https://www.lmsgen.in'
).trim().replace(/\/+$/, '') || 'https://www.lmsgen.in';

let registered = false;

function campaignPublicUrl(campaignId) {
    return `${CAMPAIGN_PUBLIC_BASE_URL}/campaign/${encodeURIComponent(String(campaignId || ''))}`;
}

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

function memberNotification(member) {
    const email = String(member.email || '').trim().toLowerCase();
    const superAdminEmail = String(process.env.SCORM_SUPER_ADMIN_EMAIL || 'tadsehimanshu@gmail.com').trim().toLowerCase();
    if (!email || email === superAdminEmail || email.endsWith('@lmsgen.internal')) return null;
    const role = String(member.role || '').toLowerCase();
    return { email, role };
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
            // Re-read after the transaction commits. Never send an invitation
            // from the stale Sequelize instance captured by the update hook.
            const liveCampaign = await ScormCampaign.findByPk(campaign.id);
            if (!liveCampaign || String(liveCampaign.status).toLowerCase() !== 'active') {
                logger.warn('campaign_invitation_skipped_inactive', {
                    module: 'mail',
                    campaignId: campaign.id,
                    status: liveCampaign?.status || 'missing'
                });
                return;
            }

            const learners = await ScormCampaignLearner.findAll({ where: { campaignId: liveCampaign.id } });
            const authMode = normalizeStoredAuthMode(liveCampaign.authMode);
            const portalUrl = campaignPublicUrl(liveCampaign.id);
            await sendInBatches(learners, async (learner) => MailService.safeSend({
                to: learner.email,
                template: 'campaign_invitation',
                data: {
                    learnerName: learner.learnerName,
                    campaignId: liveCampaign.id,
                    campaignName: liveCampaign.name,
                    dueAt: liveCampaign.dueAt,
                    accessCode: authMode === 'email_code' ? campaignAccessCode(liveCampaign.id, learner.email) : null,
                    // Absolute canonical URL prevents stale APP_BASE_URL or
                    // FRONTEND_URL values on a deployment from producing links
                    // to an old frontend/database.
                    path: portalUrl
                }
            }));
        });
    });

    ScormWorkspaceMember.addHook('afterCreate', 'mail-workspace-member-invite', (member, options) => {
        const notification = memberNotification(member);
        if (!notification) return;
        runLater(options, async () => {
            const workspace = await ScormWorkspace.findByPk(member.workspaceId);
            if (!workspace) return;
            await MailService.safeSend({
                to: notification.email,
                template: notification.role === 'admin' ? 'tenant_admin_invitation' : 'team_invitation',
                data: {
                    email: notification.email,
                    displayName: member.displayName,
                    role: notification.role,
                    workspaceName: workspace.name
                }
            });
        });
    });

    // A member can already exist in the tenant and later be promoted to Tenant
    // Admin or changed between Co-admin and Analytics Viewer. Treat that role
    // transition as a fresh access notification as well as first-time creation.
    ScormWorkspaceMember.addHook('afterUpdate', 'mail-workspace-member-role-change', (member, options) => {
        const roleChanged = member.changed('role');
        const statusChangedToInvited = member.changed('status') && String(member.status || '').toLowerCase() === 'invited';
        if (!roleChanged && !statusChangedToInvited) return;
        const notification = memberNotification(member);
        if (!notification) return;
        runLater(options, async () => {
            const workspace = await ScormWorkspace.findByPk(member.workspaceId);
            if (!workspace) return;
            await MailService.safeSend({
                to: notification.email,
                template: notification.role === 'admin' ? 'tenant_admin_invitation' : 'team_invitation',
                data: {
                    email: notification.email,
                    displayName: member.displayName,
                    role: notification.role,
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

module.exports = { register, campaignPublicUrl };
