const MailService = require('./MailService');
const {
    trainingAssignmentTemplate,
    campaignLaunchTemplate,
    teamInviteTemplate,
    tenantAdminTemplate,
    accessApprovedTemplate
} = require('./templates');
const { campaignAccessCode } = require('../scorm/ScormCampaignAuthPolicy');
const { normalizeStoredAuthMode } = require('../scorm/ScormCampaignAuthPolicy');

function roleLabel(role) {
    if (role === 'co_admin') return 'Co-admin';
    if (role === 'analytics_viewer') return 'Analytics viewer';
    if (role === 'admin') return 'Tenant Admin';
    return 'team member';
}

function resultSummary(results) {
    return results.reduce((summary, result) => {
        if (result?.sent) summary.sent += 1;
        else if (result?.skipped) summary.skipped += 1;
        else summary.failed += 1;
        return summary;
    }, { sent: 0, failed: 0, skipped: 0 });
}

async function sendDirectAssignmentEmails({ learners, courses, workspaceName, dueAt, required, portalPath = '/learn' }) {
    const results = [];
    for (const learner of learners || []) {
        const template = trainingAssignmentTemplate({
            learnerName: learner.learnerName,
            workspaceName,
            courses,
            dueAt,
            required,
            portalPath
        });
        results.push(await MailService.safeSendMail({
            to: learner.email,
            ...template,
            tag: 'training_assignment'
        }));
    }
    return resultSummary(results);
}

async function sendCampaignLaunchEmails({ campaign, learners, courses, workspaceName }) {
    const results = [];
    const mode = normalizeStoredAuthMode(campaign?.authMode);
    for (const learner of learners || []) {
        const accessCode = mode === 'email_code'
            ? campaignAccessCode(campaign.id, learner.email)
            : null;
        const template = campaignLaunchTemplate({
            learnerName: learner.learnerName,
            workspaceName,
            campaignName: campaign?.name,
            courses,
            dueAt: campaign?.dueAt,
            portalPath: `/campaign/${campaign?.id}`,
            accessCode
        });
        results.push(await MailService.safeSendMail({
            to: learner.email,
            ...template,
            tag: 'campaign_launch'
        }));
    }
    return resultSummary(results);
}

async function sendTeamInviteEmail({ member, workspaceName, invitedByEmail }) {
    if (!member?.email) return { sent: 0, failed: 0, skipped: 1 };
    const template = teamInviteTemplate({
        displayName: member.displayName,
        workspaceName,
        roleLabel: roleLabel(member.role),
        invitedByEmail
    });
    const result = await MailService.safeSendMail({
        to: member.email,
        ...template,
        tag: 'team_invite'
    });
    return resultSummary([result]);
}

async function sendTenantAdminEmail({ adminEmail, adminName, workspaceName, changed = false }) {
    const template = tenantAdminTemplate({ adminName, workspaceName, changed });
    const result = await MailService.safeSendMail({
        to: adminEmail,
        ...template,
        tag: changed ? 'tenant_admin_changed' : 'tenant_admin_welcome'
    });
    return resultSummary([result]);
}

async function sendAccessApprovedEmail({ email, name }) {
    const template = accessApprovedTemplate({ name });
    const result = await MailService.safeSendMail({
        to: email,
        ...template,
        tag: 'access_approved'
    });
    return resultSummary([result]);
}

module.exports = {
    sendDirectAssignmentEmails,
    sendCampaignLaunchEmails,
    sendTeamInviteEmail,
    sendTenantAdminEmail,
    sendAccessApprovedEmail
};
