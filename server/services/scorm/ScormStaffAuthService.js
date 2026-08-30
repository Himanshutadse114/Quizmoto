const User = require('../../models/User');
const {
    ScormWorkspaceMember
} = require('../../models/scorm');
const {
    getWorkspaceAndConfig,
    normalizeEmail,
    normalizeDomains,
    verifyGoogleCredential,
    verifyMicrosoftCredential
} = require('./ScormLearnerAuthService');

const STAFF_JOINING_MODES = Object.freeze(['password_or_sso', 'sso_only']);
const STAFF_ROLES = Object.freeze(['admin', 'co_admin', 'analytics_viewer']);

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normalizeStaffJoiningMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    return STAFF_JOINING_MODES.includes(mode) ? mode : 'password_or_sso';
}

function parseJsonDomains(value) {
    if (!value) return [];
    try {
        return normalizeDomains(JSON.parse(value));
    } catch (_) {
        return normalizeDomains(value);
    }
}

function staffProviderConfig(config) {
    return {
        googleEnabled: Boolean(config?.staffGoogleEnabled),
        googleClientId: config?.staffGoogleClientId || null,
        microsoftEnabled: Boolean(config?.staffMicrosoftEnabled),
        microsoftClientId: config?.staffMicrosoftClientId || null,
        microsoftTenantId: config?.staffMicrosoftTenantId || null,
        allowedDomainsJson: config?.staffAllowedDomainsJson || null
    };
}

function serializeStaffAuthConfig(config, { workspace = null, publicView = false } = {}) {
    const staffJoiningMode = normalizeStaffJoiningMode(config?.staffJoiningMode);
    const staffGoogleEnabled = Boolean(config?.staffGoogleEnabled && config?.staffGoogleClientId);
    const staffMicrosoftEnabled = Boolean(
        config?.staffMicrosoftEnabled && config?.staffMicrosoftClientId && config?.staffMicrosoftTenantId
    );
    const data = {
        workspaceId: config?.workspaceId || workspace?.id || null,
        workspaceName: workspace?.name || null,
        staffJoiningMode,
        staffPasswordEnabled: staffJoiningMode !== 'sso_only',
        staffSsoRequired: staffJoiningMode === 'sso_only',
        staffGoogleEnabled,
        staffGoogleClientId: staffGoogleEnabled ? config.staffGoogleClientId : null,
        staffMicrosoftEnabled,
        staffMicrosoftClientId: staffMicrosoftEnabled ? config.staffMicrosoftClientId : null,
        staffMicrosoftTenantId: staffMicrosoftEnabled ? config.staffMicrosoftTenantId : null,
        staffAllowedDomains: parseJsonDomains(config?.staffAllowedDomainsJson)
    };
    if (!publicView) {
        data.updatedAt = config?.updatedAt || null;
        data.updatedByUserId = config?.updatedByUserId || null;
    }
    return data;
}

async function saveStaffAuthConfig({ workspaceId, actorUserId, values }) {
    const { workspace, config } = await getWorkspaceAndConfig(workspaceId);
    const staffJoiningMode = normalizeStaffJoiningMode(values?.staffJoiningMode);
    const staffGoogleClientId = String(values?.staffGoogleClientId || '').trim().slice(0, 255) || null;
    const staffMicrosoftClientId = String(values?.staffMicrosoftClientId || '').trim().slice(0, 255) || null;
    const staffMicrosoftTenantId = String(values?.staffMicrosoftTenantId || '').trim().slice(0, 128) || null;
    const staffGoogleEnabled = Boolean(values?.staffGoogleEnabled && staffGoogleClientId);
    const staffMicrosoftEnabled = Boolean(
        values?.staffMicrosoftEnabled && staffMicrosoftClientId && staffMicrosoftTenantId
    );

    if (staffJoiningMode === 'sso_only' && !staffGoogleEnabled && !staffMicrosoftEnabled) {
        throw fail(
            'Enable Google or Microsoft for staff before switching Admin & team access to SSO only.',
            'SCORM_STAFF_SSO_PROVIDER_REQUIRED',
            400
        );
    }

    config.staffJoiningMode = staffJoiningMode;
    config.staffGoogleEnabled = staffGoogleEnabled;
    config.staffGoogleClientId = staffGoogleClientId;
    config.staffMicrosoftEnabled = staffMicrosoftEnabled;
    config.staffMicrosoftClientId = staffMicrosoftClientId;
    config.staffMicrosoftTenantId = staffMicrosoftTenantId;
    config.staffAllowedDomainsJson = JSON.stringify(normalizeDomains(values?.staffAllowedDomains));
    config.updatedByUserId = actorUserId || null;
    await config.save();
    return serializeStaffAuthConfig(config, { workspace });
}

async function getPublicStaffAuthConfig(workspaceId) {
    const { workspace, config } = await getWorkspaceAndConfig(workspaceId);
    return serializeStaffAuthConfig(config, { workspace, publicView: true });
}

async function verifyStaffIdentity({ workspaceId, provider, credential }) {
    const { workspace, config } = await getWorkspaceAndConfig(workspaceId);
    const verificationConfig = staffProviderConfig(config);
    let identity;
    if (provider === 'google') {
        identity = await verifyGoogleCredential(verificationConfig, credential);
    } else if (provider === 'microsoft') {
        identity = await verifyMicrosoftCredential(verificationConfig, credential);
    } else {
        throw fail('Unsupported staff SSO provider.', 'SCORM_STAFF_SSO_PROVIDER_INVALID', 400);
    }

    const email = normalizeEmail(identity.email);
    const member = await ScormWorkspaceMember.findOne({
        where: { workspaceId: workspace.id, email }
    });
    if (!member || member.status === 'disabled' || !STAFF_ROLES.includes(String(member.role || '').toLowerCase())) {
        throw fail(
            'This account is not an authorised Admin, Co-admin or Analytics Viewer for this workspace.',
            'SCORM_STAFF_NOT_AUTHORISED',
            403
        );
    }

    let user = await User.findOne({ where: { email } });
    if (!user) {
        const baseUsername = String(identity.name || email.split('@')[0] || 'Staff').trim().slice(0, 80);
        const usernameTaken = await User.findOne({ where: { username: baseUsername } });
        user = await User.create({
            username: usernameTaken ? `${baseUsername}-${Math.floor(1000 + Math.random() * 9000)}` : baseUsername,
            email
        });
    } else if (!user.username && identity.name) {
        user.username = String(identity.name).trim().slice(0, 80);
        await user.save();
    }

    let memberChanged = false;
    if (member.userId !== user.id) {
        member.userId = user.id;
        memberChanged = true;
    }
    if (member.status !== 'active') {
        member.status = 'active';
        memberChanged = true;
    }
    if (!member.joinedAt) {
        member.joinedAt = new Date();
        memberChanged = true;
    }
    if (!member.displayName && identity.name) {
        member.displayName = String(identity.name).trim().slice(0, 160);
        memberChanged = true;
    }
    if (memberChanged) await member.save();

    return {
        workspace,
        config,
        identity,
        member,
        user,
        role: String(member.role || '').toLowerCase()
    };
}

async function getStaffPolicyForEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const member = await ScormWorkspaceMember.findOne({ where: { email: normalized } });
    if (!member || member.status === 'disabled') return null;
    const { workspace, config } = await getWorkspaceAndConfig(member.workspaceId);
    return {
        workspace,
        member,
        config,
        publicConfig: serializeStaffAuthConfig(config, { workspace, publicView: true })
    };
}

module.exports = {
    STAFF_JOINING_MODES,
    normalizeStaffJoiningMode,
    serializeStaffAuthConfig,
    saveStaffAuthConfig,
    getPublicStaffAuthConfig,
    verifyStaffIdentity,
    getStaffPolicyForEmail
};
