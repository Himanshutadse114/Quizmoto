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
    /**
     * When false (default), all session transitions use the legacy status path.
     * When true, SessionCommandService / V2 state machine may be used.
     */
    get newSessionEngine() {
        return envBool('NEW_SESSION_ENGINE', false);
    },

    /**
     * Phase 3: when false (default), report export runs in-process (legacy).
     * When true, report jobs are enqueued to a background worker.
     */
    get reportsAsync() {
        return envBool('REPORTS_ASYNC', false);
    }
};

module.exports = { featureFlags, envBool };
