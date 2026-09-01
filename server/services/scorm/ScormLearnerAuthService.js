const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
    ScormWorkspace,
    ScormWorkspaceAuthConfig,
    ScormRegistration,
    ScormCourse,
    ScormPackage
} = require('../../models/scorm');
const {
    signRegistrationToken,
    hashToken
} = require('./ScormInviteService');
const { ensurePackageLaunchMetadata } = require('./ScormLaunchMetadataService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const GLOBAL_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1001652255296-695gf3vjul0fjh1oden4k2n6tvvdvncn.apps.googleusercontent.com';
const JOINING_MODES = Object.freeze(['assigned_email', 'sso_preferred', 'sso_only']);
const microsoftKeyCache = new Map();

function fail(message, code, status = 400) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeJoiningMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    return JOINING_MODES.includes(mode) ? mode : 'assigned_email';
}

function normalizeDomains(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
    return [...new Set(source
        .map((item) => String(item || '').trim().toLowerCase().replace(/^@/, ''))
        .filter((item) => item && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(item))
    )].slice(0, 50);
}

function parseDomains(config) {
    if (!config?.allowedDomainsJson) return [];
    try {
        return normalizeDomains(JSON.parse(config.allowedDomainsJson));
    } catch (_) {
        return normalizeDomains(config.allowedDomainsJson);
    }
}

function emailDomain(email) {
    return normalizeEmail(email).split('@')[1] || '';
}

function assertDomainAllowed(email, config) {
    const domains = parseDomains(config);
    if (!domains.length) return true;
    if (!domains.includes(emailDomain(email))) {
        throw fail(
            'Your organisation has restricted learner access to approved email domains.',
            'SCORM_LEARNER_DOMAIN_NOT_ALLOWED',
            403
        );
    }
    return true;
}

function serializeAuthConfig(config, { workspace = null, publicView = false } = {}) {
    const joiningMode = normalizeJoiningMode(config?.joiningMode);
    const googleEnabled = Boolean(config?.googleEnabled && config?.googleClientId);
    const microsoftEnabled = Boolean(config?.microsoftEnabled && config?.microsoftClientId && config?.microsoftTenantId);
    const base = {
        workspaceId: config?.workspaceId || workspace?.id || null,
        workspaceName: workspace?.name || null,
        joiningMode,
        googleEnabled,
        googleClientId: googleEnabled ? config.googleClientId : null,
        microsoftEnabled,
        microsoftClientId: microsoftEnabled ? config.microsoftClientId : null,
        microsoftTenantId: microsoftEnabled ? config.microsoftTenantId : null,
        allowedDomains: parseDomains(config),
        emailEnabled: joiningMode !== 'sso_only',
        ssoRequired: joiningMode === 'sso_only'
    };
    if (!publicView) {
        base.updatedAt = config?.updatedAt || null;
        base.updatedByUserId = config?.updatedByUserId || null;
    }
    return base;
}

async function getWorkspaceAndConfig(workspaceId) {
    const workspace = await ScormWorkspace.findByPk(workspaceId);
    if (!workspace || workspace.status !== 'active') {
        throw fail('Learner workspace not found.', 'SCORM_LEARNER_WORKSPACE_NOT_FOUND', 404);
    }
    const [config] = await ScormWorkspaceAuthConfig.findOrCreate({
        where: { workspaceId: workspace.id },
        defaults: { workspaceId: workspace.id, joiningMode: 'assigned_email' }
    });
    return { workspace, config };
}

async function saveAuthConfig({ workspaceId, actorUserId, values }) {
    const { workspace, config } = await getWorkspaceAndConfig(workspaceId);
    const joiningMode = normalizeJoiningMode(values?.joiningMode);
    const googleClientId = String(values?.googleClientId || '').trim().slice(0, 255) || null;
    const microsoftClientId = String(values?.microsoftClientId || '').trim().slice(0, 255) || null;
    const microsoftTenantId = String(values?.microsoftTenantId || '').trim().slice(0, 128) || null;
    const googleEnabled = Boolean(values?.googleEnabled && googleClientId);
    const microsoftEnabled = Boolean(values?.microsoftEnabled && microsoftClientId && microsoftTenantId);

    if (joiningMode === 'sso_only' && !googleEnabled && !microsoftEnabled) {
        throw fail(
            'Enable Google or Microsoft before switching learner access to SSO only.',
            'SCORM_SSO_PROVIDER_REQUIRED',
            400
        );
    }

    config.joiningMode = joiningMode;
    config.googleEnabled = googleEnabled;
    config.googleClientId = googleClientId;
    config.microsoftEnabled = microsoftEnabled;
    config.microsoftClientId = microsoftClientId;
    config.microsoftTenantId = microsoftTenantId;
    config.allowedDomainsJson = JSON.stringify(normalizeDomains(values?.allowedDomains));
    config.updatedByUserId = actorUserId || null;
    await config.save();
    return serializeAuthConfig(config, { workspace });
}

function extractIdentity(payload, provider) {
    const email = normalizeEmail(
        payload?.email || payload?.preferred_username || payload?.upn || payload?.unique_name
    );
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw fail('The identity provider did not return a valid learner email.', 'SCORM_LEARNER_EMAIL_REQUIRED', 401);
    }
    const name = String(payload?.name || payload?.given_name || email.split('@')[0] || 'Learner').trim().slice(0, 255);
    return { email, name, provider };
}

async function verifyGoogleCredential(config, credential) {
    if (!config?.googleEnabled || !config?.googleClientId) {
        throw fail('Google learner SSO is not enabled for this workspace.', 'SCORM_GOOGLE_SSO_DISABLED', 403);
    }
    const client = new OAuth2Client(config.googleClientId);
    let ticket;
    try {
        ticket = await client.verifyIdToken({ idToken: String(credential || ''), audience: config.googleClientId });
    } catch (_) {
        throw fail('Google sign-in could not be verified.', 'SCORM_GOOGLE_SSO_INVALID', 401);
    }
    const payload = ticket.getPayload() || {};
    if (payload.email_verified !== true) {
        throw fail('A verified Google email address is required.', 'SCORM_GOOGLE_EMAIL_UNVERIFIED', 401);
    }
    const identity = extractIdentity(payload, 'google');
    assertDomainAllowed(identity.email, config);
    return identity;
}

async function verifyGlobalGoogleCredential(credential) {
    const client = new OAuth2Client(GLOBAL_GOOGLE_CLIENT_ID);
    let ticket;
    try {
        ticket = await client.verifyIdToken({
            idToken: String(credential || ''),
            audience: GLOBAL_GOOGLE_CLIENT_ID
        });
    } catch (_) {
        throw fail('Google sign-in could not be verified.', 'SCORM_GOOGLE_SSO_INVALID', 401);
    }
    const payload = ticket.getPayload() || {};
    if (payload.email_verified !== true) {
        throw fail('A verified Google email address is required.', 'SCORM_GOOGLE_EMAIL_UNVERIFIED', 401);
    }
    return extractIdentity(payload, 'google');
}

async function getMicrosoftSigningKey(tenantId, kid) {
    const cacheKey = String(tenantId || '').toLowerCase();
    let cached = microsoftKeyCache.get(cacheKey);
    if (!cached || cached.expiresAt < Date.now()) {
        const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/discovery/v2.0/keys`);
        if (!response.ok) throw new Error(`Microsoft JWKS ${response.status}`);
        const json = await response.json();
        cached = { keys: Array.isArray(json.keys) ? json.keys : [], expiresAt: Date.now() + 60 * 60 * 1000 };
        microsoftKeyCache.set(cacheKey, cached);
    }
    const jwk = cached.keys.find((key) => key.kid === kid);
    if (!jwk) {
        microsoftKeyCache.delete(cacheKey);
        throw new Error('Microsoft signing key not found');
    }
    return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

async function verifyMicrosoftCredential(config, idToken) {
    if (!config?.microsoftEnabled || !config?.microsoftClientId || !config?.microsoftTenantId) {
        throw fail('Microsoft learner SSO is not enabled for this workspace.', 'SCORM_MICROSOFT_SSO_DISABLED', 403);
    }
    const token = String(idToken || '').trim();
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded?.header?.kid;
    const tenantId = String(config.microsoftTenantId).trim();
    if (!kid || !decoded?.payload) {
        throw fail('Microsoft sign-in could not be verified.', 'SCORM_MICROSOFT_SSO_INVALID', 401);
    }
    if (String(decoded.payload.tid || '').toLowerCase() !== tenantId.toLowerCase()) {
        throw fail('This Microsoft account belongs to a different organisation tenant.', 'SCORM_MICROSOFT_TENANT_MISMATCH', 403);
    }

    let payload;
    try {
        const publicKey = await getMicrosoftSigningKey(tenantId, kid);
        payload = jwt.verify(token, publicKey, {
            algorithms: ['RS256'],
            audience: config.microsoftClientId,
            issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`
        });
    } catch (_) {
        throw fail('Microsoft sign-in could not be verified.', 'SCORM_MICROSOFT_SSO_INVALID', 401);
    }

    const identity = extractIdentity(payload, 'microsoft');
    assertDomainAllowed(identity.email, config);
    return identity;
}

async function findAssignedRegistrations(hostId, email) {
    const normalized = normalizeEmail(email);
    return ScormRegistration.findAll({
        where: {
            isPreview: false,
            campaignId: null,
            status: { [Op.notIn]: ['revoked', 'superseded'] },
            [Op.and]: [
                sequelize.where(sequelize.fn('LOWER', sequelize.col('learnerEmail')), normalized)
            ]
        },
        include: [{
            model: ScormCourse,
            as: 'course',
            required: true,
            where: { hostId, status: 'published' },
            include: [{ model: ScormPackage, as: 'package', required: false }]
        }],
        order: [['assignedAt', 'DESC'], ['createdAt', 'DESC']]
    });
}

async function assertLearnerAssigned(workspace, identity) {
    const assignments = await findAssignedRegistrations(workspace.ownerUserId, identity.email);
    if (!assignments.length) {
        throw fail(
            'No direct courses are assigned to this learner account. If your course was assigned through a campaign, use the campaign link sent by your administrator.',
            'SCORM_LEARNER_NOT_ASSIGNED',
            403
        );
    }
    return assignments;
}

function issueLearnerToken({ workspace, identity }) {
    return jwt.sign({
        typ: 'scorm_learner',
        workspaceId: workspace.id,
        hostId: workspace.ownerUserId,
        email: identity.email,
        name: identity.name,
        provider: identity.provider || 'email'
    }, JWT_SECRET, { expiresIn: '12h' });
}

function verifyLearnerToken(token) {
    try {
        const decoded = jwt.verify(String(token || ''), JWT_SECRET);
        if (decoded.typ !== 'scorm_learner' || !decoded.workspaceId || !decoded.hostId || !decoded.email) {
            throw new Error('invalid learner token');
        }
        return decoded;
    } catch (_) {
        throw fail('Learner session expired. Sign in again.', 'SCORM_LEARNER_AUTH_REQUIRED', 401);
    }
}

function learnerAuthMiddleware(req, res, next) {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '') || '';
        req.scormLearner = verifyLearnerToken(token);
        next();
    } catch (err) {
        res.status(err.status || 401).json({ message: err.message, code: err.code });
    }
}

function serializeAssignment(registration) {
    const course = registration.course;
    const lessonStatus = registration.lastLessonStatus || 'not attempted';
    const completed = registration.status === 'completed' || ['completed', 'passed', 'failed'].includes(String(lessonStatus).toLowerCase());
    const started = completed || registration.status === 'active' || Boolean(registration.lastCommitAt);
    return {
        instanceId: registration.id,
        registrationId: registration.id,
        courseId: course?.id || registration.courseId,
        title: course?.title || 'Course',
        description: course?.description || null,
        status: completed ? 'completed' : started ? 'in_progress' : 'not_started',
        lessonStatus,
        score: registration.lastScoreRaw == null ? null : Number(registration.lastScoreRaw),
        totalTime: registration.lastTotalTime || null,
        assignedAt: registration.assignedAt || registration.createdAt,
        dueAt: registration.dueAt || null,
        required: registration.required !== false,
        lastActivityAt: registration.lastCommitAt || null
    };
}

async function createLearnerSessionFromIdentity({ workspaceId, identity, requireGoogleEnabled = false }) {
    const { workspace, config } = await getWorkspaceAndConfig(workspaceId);
    if (requireGoogleEnabled && identity?.provider === 'google' && !config?.googleEnabled) {
        throw fail('Google learner sign-in is not enabled for this organisation.', 'SCORM_GOOGLE_SSO_DISABLED', 403);
    }
    if (!identity?.email) throw fail('Learner identity is missing an email address.', 'SCORM_LEARNER_EMAIL_REQUIRED', 400);
    assertDomainAllowed(identity.email, config);
    const assignments = await assertLearnerAssigned(workspace, identity);
    const token = issueLearnerToken({ workspace, identity });
    return {
        token,
        learner: { email: identity.email, name: identity.name, provider: identity.provider },
        workspace: { id: workspace.id, name: workspace.name },
        courses: assignments.map(serializeAssignment)
    };
}

async function createLearnerSession({ workspaceId, provider, credential, email, name }) {
    const { config } = await getWorkspaceAndConfig(workspaceId);
    let identity;
    if (provider === 'google') {
        identity = await verifyGoogleCredential(config, credential);
    } else if (provider === 'microsoft') {
        identity = await verifyMicrosoftCredential(config, credential);
    } else {
        if (normalizeJoiningMode(config.joiningMode) === 'sso_only') {
            throw fail('This organisation requires SSO. Use Google or Microsoft to continue.', 'SCORM_SSO_REQUIRED', 403);
        }
        identity = {
            email: normalizeEmail(email),
            name: String(name || '').trim().slice(0, 255) || normalizeEmail(email).split('@')[0] || 'Learner',
            provider: 'email'
        };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) {
            throw fail('Enter your assigned learner email.', 'SCORM_LEARNER_EMAIL_REQUIRED', 400);
        }
    }

    return createLearnerSessionFromIdentity({ workspaceId, identity });
}

async function getLearnerDashboard(context) {
    const workspace = await ScormWorkspace.findByPk(context.workspaceId);
    if (!workspace || Number(workspace.ownerUserId) !== Number(context.hostId) || workspace.status !== 'active') {
        throw fail('Learner workspace is no longer active.', 'SCORM_LEARNER_WORKSPACE_NOT_FOUND', 404);
    }
    const assignments = await findAssignedRegistrations(context.hostId, context.email);
    return {
        learner: { email: context.email, name: context.name || context.email, provider: context.provider || 'email' },
        workspace: { id: workspace.id, name: workspace.name },
        courses: assignments.map(serializeAssignment)
    };
}

async function launchLearnerCourse(context, registrationId) {
    const registration = await ScormRegistration.findByPk(registrationId, {
        include: [{
            model: ScormCourse,
            as: 'course',
            include: [{ model: ScormPackage, as: 'package' }]
        }]
    });
    if (!registration || registration.isPreview || ['revoked', 'superseded'].includes(registration.status) || !registration.course) {
        throw fail('Course assignment not found.', 'SCORM_ASSIGNMENT_NOT_FOUND', 404);
    }
    if (registration.campaignId && context.typ !== 'scorm_campaign_learner') {
        throw fail('This course was assigned through a campaign. Open it from the campaign learner link.', 'SCORM_CAMPAIGN_AUTH_REQUIRED', 403);
    }
    if (registration.campaignId && context.typ === 'scorm_campaign_learner' && String(registration.campaignId) !== String(context.campaignId || '')) {
        throw fail('This course belongs to a different campaign.', 'SCORM_CAMPAIGN_ASSIGNMENT_FORBIDDEN', 403);
    }
    if (Number(registration.course.hostId) !== Number(context.hostId) || normalizeEmail(registration.learnerEmail) !== normalizeEmail(context.email)) {
        throw fail('This course is not assigned to your learner account.', 'SCORM_ASSIGNMENT_FORBIDDEN', 403);
    }
    if (registration.course.status !== 'published') {
        throw fail('This course is not currently published.', 'SCORM_COURSE_NOT_PUBLISHED', 409);
    }
    const pkg = registration.course.package;
    if (!pkg || pkg.status !== 'ready') {
        throw fail('Course package is not ready.', 'PACKAGE_NOT_READY', 409);
    }
    await ensurePackageLaunchMetadata(pkg);
    const playToken = signRegistrationToken(registration.id, registration.course.id);
    registration.inviteTokenHash = hashToken(playToken);
    if (registration.status === 'assigned' || registration.status === 'invited') registration.status = 'active';
    await registration.save();

    return {
        instanceId: registration.id,
        registrationId: registration.id,
        token: playToken,
        playToken,
        packageId: pkg.id,
        entryHref: pkg.entryHref,
        course: {
            id: registration.course.id,
            title: registration.course.title,
            description: registration.course.description
        },
        playerPath: `/scorm/player/${registration.id}`,
        playUrl: `/api/scorm/play/${registration.id}`
    };
}

module.exports = {
    JOINING_MODES,
    normalizeEmail,
    normalizeJoiningMode,
    normalizeDomains,
    serializeAuthConfig,
    getWorkspaceAndConfig,
    saveAuthConfig,
    verifyGoogleCredential,
    verifyGlobalGoogleCredential,
    verifyMicrosoftCredential,
    findAssignedRegistrations,
    assertLearnerAssigned,
    issueLearnerToken,
    verifyLearnerToken,
    learnerAuthMiddleware,
    createLearnerSession,
    createLearnerSessionFromIdentity,
    getLearnerDashboard,
    launchLearnerCourse
};
