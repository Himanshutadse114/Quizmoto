const MailService = require('../mail/MailService');
const {
    normalizeEmail,
    normalizeJoiningMode,
    getWorkspaceAndConfig,
    findAssignedRegistrations,
    createLearnerSessionFromIdentity
} = require('./ScormLearnerAuthService');
const { issueOtp, verifyOtp, settings } = require('./ScormLearnerOtpService');

function fail(message, code, status = 400, extras = {}) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    Object.assign(err, extras);
    return err;
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function assertEmailDomain(email, config) {
    let domains = [];
    try {
        const parsed = JSON.parse(config?.allowedDomainsJson || '[]');
        domains = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        domains = String(config?.allowedDomainsJson || '').split(/[\s,;]+/);
    }
    domains = domains.map((value) => String(value || '').trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    if (!domains.length) return;
    const domain = email.split('@')[1] || '';
    if (!domains.includes(domain)) {
        throw fail(
            'Your organisation has restricted learner access to approved email domains.',
            'SCORM_LEARNER_DOMAIN_NOT_ALLOWED',
            403
        );
    }
}

function neutralOtpResponse() {
    const config = settings();
    return {
        ok: true,
        verificationRequired: true,
        message: 'If training is assigned to this email, a verification code has been sent.',
        expiresInSeconds: config.ttlSeconds,
        resendAfterSeconds: config.resendSeconds
    };
}

async function requestLearnerEmailOtp({ workspaceId, email }) {
    // Fail consistently for every address when SMTP itself is unavailable. This
    // prevents assignment membership from being inferred from a 503 response.
    MailService.assertConfigured();

    const normalized = normalizeEmail(email);
    if (!validEmail(normalized)) {
        throw fail('Enter your assigned learner email.', 'SCORM_LEARNER_EMAIL_REQUIRED', 400);
    }

    const { workspace, config } = await getWorkspaceAndConfig(workspaceId);
    if (normalizeJoiningMode(config.joiningMode) === 'sso_only') {
        throw fail('This organisation requires SSO. Use Google or Microsoft to continue.', 'SCORM_SSO_REQUIRED', 403);
    }
    assertEmailDomain(normalized, config);

    const assignments = await findAssignedRegistrations(workspace.ownerUserId, normalized);
    if (!assignments.length) {
        // Do not reveal whether an email address is on the learner roster.
        return neutralOtpResponse();
    }

    const learnerName = String(
        assignments.find((row) => row.learnerName)?.learnerName ||
        normalized.split('@')[0] ||
        'Learner'
    ).trim().slice(0, 255);

    const issued = await issueOtp({
        workspaceId: workspace.id,
        email: normalized,
        learnerName,
        workspaceName: workspace.name
    });

    return {
        ...neutralOtpResponse(),
        expiresInSeconds: issued.expiresInSeconds,
        resendAfterSeconds: issued.resendAfterSeconds
    };
}

async function verifyLearnerEmailOtp({ workspaceId, email, code }) {
    const normalized = normalizeEmail(email);
    if (!validEmail(normalized)) {
        throw fail('Enter your assigned learner email.', 'SCORM_LEARNER_EMAIL_REQUIRED', 400);
    }

    await verifyOtp({ workspaceId, email: normalized, code });

    // Resolve the display identity from the committed assignment after email
    // ownership has been proved. The browser cannot override the learner name.
    const { workspace } = await getWorkspaceAndConfig(workspaceId);
    const assignments = await findAssignedRegistrations(workspace.ownerUserId, normalized);
    if (!assignments.length) {
        throw fail('No active training is assigned to this email.', 'SCORM_LEARNER_NOT_ASSIGNED', 403);
    }
    const learnerName = String(
        assignments.find((row) => row.learnerName)?.learnerName ||
        normalized.split('@')[0] ||
        'Learner'
    ).trim().slice(0, 255);

    return createLearnerSessionFromIdentity({
        workspaceId,
        identity: {
            email: normalized,
            name: learnerName,
            provider: 'email_otp'
        }
    });
}

module.exports = {
    requestLearnerEmailOtp,
    verifyLearnerEmailOtp
};
