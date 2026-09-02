const RuntimeStore = require('./ScormRuntimeSnapshotStore');

/**
 * Batch reader used by admin tracking, reports and dashboards.
 * RuntimeStore owns the Supabase-compatible fallback between the compact
 * snapshot table and the historical CMI table, so every consumer sees the same
 * canonical learner state.
 */
async function listByRegistrationIds(registrationIds) {
    const ids = Array.from(new Set((registrationIds || []).filter(Boolean).map(String)));
    if (!ids.length) return new Map();

    try {
        return await RuntimeStore.list(ids);
    } catch (err) {
        console.warn('[scorm-runtime] canonical batch read failed', {
            registrations: ids.length,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        return new Map();
    }
}

module.exports = { listByRegistrationIds };
