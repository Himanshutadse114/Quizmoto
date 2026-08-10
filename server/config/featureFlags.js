/**
 * Feature flags for Quizmoto Phase 2+.
 * Defaults keep production behaviour unchanged.
 */

function envBool(name, defaultValue = false) {
    const v = process.env[name];
    if (v === undefined || v === null || v === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const featureFlags = {
    get newSessionEngine() {
        return envBool('NEW_SESSION_ENGINE', false);
    },
    get reportsAsync() {
        return envBool('REPORTS_ASYNC', false);
    },
    /** SCORM World LMS add-on (default OFF). */
    get scormLms() {
        return envBool('SCORM_LMS', false);
    },
    /** AI PDF/PPT → SCORM author path (default OFF). */
    get scormAiAuthor() {
        return envBool('SCORM_AI_AUTHOR', false);
    },
    get scormPublicInvites() {
        return envBool('SCORM_PUBLIC_INVITES', true);
    }
};

function scormMaxUploadMb() {
    const n = Number(process.env.SCORM_MAX_UPLOAD_MB);
    return Number.isFinite(n) && n > 0 ? n : 100;
}

module.exports = { featureFlags, envBool, scormMaxUploadMb };
