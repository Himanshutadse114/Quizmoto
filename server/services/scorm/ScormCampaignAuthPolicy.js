const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const CAMPAIGN_AUTH_MODES = Object.freeze(['email_code', 'google', 'microsoft', 'sso_any']);
const NEW_CAMPAIGN_AUTH_MODES = Object.freeze(['email_code', 'google', 'microsoft']);

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeRequestedAuthMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    return NEW_CAMPAIGN_AUTH_MODES.includes(mode) ? mode : 'email_code';
}

function normalizeStoredAuthMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    return CAMPAIGN_AUTH_MODES.includes(mode) ? mode : 'sso_any';
}

function providerAllowedForCampaign(authMode, provider) {
    const mode = normalizeStoredAuthMode(authMode);
    const authProvider = String(provider || '').trim().toLowerCase();
    if (mode === 'sso_any') return authProvider === 'google' || authProvider === 'microsoft';
    if (mode === 'email_code') return authProvider === 'email_code';
    return authProvider === mode;
}

function authModeLabel(authMode) {
    const mode = normalizeStoredAuthMode(authMode);
    if (mode === 'google') return 'Google SSO';
    if (mode === 'microsoft') return 'Microsoft SSO';
    if (mode === 'email_code') return 'Email + access code';
    return 'Google or Microsoft SSO';
}

function normalizedAccessCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function campaignAccessCode(campaignId, email) {
    const material = `${String(campaignId || '').trim()}:${normalizeEmail(email)}`;
    const secret = `${JWT_SECRET}:scorm-campaign-access-code:v1`;
    const digest = crypto.createHmac('sha256', secret).update(material).digest('hex').toUpperCase();
    const raw = digest.slice(0, 12);
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function verifyCampaignAccessCode(campaignId, email, value) {
    const supplied = normalizedAccessCode(value);
    const expected = normalizedAccessCode(campaignAccessCode(campaignId, email));
    if (!supplied || supplied.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

module.exports = {
    CAMPAIGN_AUTH_MODES,
    NEW_CAMPAIGN_AUTH_MODES,
    normalizeRequestedAuthMode,
    normalizeStoredAuthMode,
    providerAllowedForCampaign,
    authModeLabel,
    campaignAccessCode,
    verifyCampaignAccessCode,
    normalizedAccessCode
};
