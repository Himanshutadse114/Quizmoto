const {
    ScormCmiState,
    ScormRuntimeSnapshot
} = require('../../models/scorm');

const STATE_KEYS = [
    'attemptId',
    'lessonStatus',
    'scoreRaw',
    'scoreMin',
    'scoreMax',
    'lessonLocation',
    'suspendData',
    'entry',
    'exit',
    'totalTime',
    'sessionTime',
    'interactionsJson',
    'rawMapJson',
    'stateVersion',
    'initialized'
];

function defaultState() {
    return {
        attemptId: null,
        lessonStatus: 'not attempted',
        scoreRaw: null,
        scoreMin: null,
        scoreMax: null,
        lessonLocation: null,
        suspendData: '',
        entry: 'ab-initio',
        exit: '',
        totalTime: '00:00:00.00',
        sessionTime: '00:00:00.00',
        interactionsJson: null,
        rawMapJson: '{}',
        stateVersion: 0,
        initialized: false
    };
}

function plain(value) {
    if (!value) return null;
    return typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function normalizeState(value) {
    const source = plain(value) || {};
    const state = defaultState();
    for (const key of STATE_KEYS) {
        if (source[key] !== undefined && source[key] !== null) state[key] = source[key];
    }
    state.stateVersion = Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : 0;
    state.initialized = !!state.initialized;
    state.rawMapJson = typeof state.rawMapJson === 'string' && state.rawMapJson ? state.rawMapJson : '{}';
    state.suspendData = typeof state.suspendData === 'string' ? state.suspendData : '';
    state.totalTime = typeof state.totalTime === 'string' && state.totalTime ? state.totalTime : '00:00:00.00';
    state.sessionTime = typeof state.sessionTime === 'string' && state.sessionTime ? state.sessionTime : '00:00:00.00';
    return state;
}

function payloadFromSnapshot(snapshot) {
    const row = plain(snapshot);
    if (!row) return null;
    try {
        const parsed = typeof row.payloadJson === 'string' ? JSON.parse(row.payloadJson) : row.payloadJson;
        return normalizeState({
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
            stateVersion: row.stateVersion ?? parsed?.stateVersion,
            initialized: row.initialized ?? parsed?.initialized
        });
    } catch (_) {
        return null;
    }
}

async function writeSnapshot(registrationId, state) {
    const normalized = normalizeState(state);
    await ScormRuntimeSnapshot.upsert({
        registrationId,
        payloadJson: JSON.stringify(normalized),
        stateVersion: normalized.stateVersion,
        initialized: normalized.initialized
    });
    return normalized;
}

async function load(registrationId) {
    const snapshot = await ScormRuntimeSnapshot.findByPk(registrationId);
    const canonical = payloadFromSnapshot(snapshot);
    if (canonical) return canonical;

    // One-time migration-on-read. A broken legacy table must never prevent a
    // learner from receiving a usable runtime state.
    let migrated = null;
    try {
        const legacy = await ScormCmiState.findOne({ where: { registrationId } });
        if (legacy) migrated = normalizeState(legacy);
    } catch (err) {
        console.warn('[scorm-runtime] legacy state read skipped', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
    }

    return writeSnapshot(registrationId, migrated || defaultState());
}

async function projectLegacy(registrationId, state) {
    const normalized = normalizeState(state);
    try {
        let legacy = await ScormCmiState.findOne({ where: { registrationId } });
        if (!legacy) legacy = ScormCmiState.build({ registrationId });
        for (const key of STATE_KEYS) legacy[key] = normalized[key];
        await legacy.save();
        return true;
    } catch (err) {
        console.warn('[scorm-runtime] legacy CMI projection failed', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        return false;
    }
}

function queueLegacyProjection(registrationId, state) {
    const copy = normalizeState(state);
    setImmediate(() => {
        projectLegacy(registrationId, copy).catch(() => {});
    });
}

async function save(registrationId, state, options = {}) {
    const normalized = await writeSnapshot(registrationId, state);
    if (options.projectLegacy !== false) queueLegacyProjection(registrationId, normalized);
    return normalized;
}

async function destroy(registrationId, options = {}) {
    const destroyOptions = { where: { registrationId } };
    if (options.transaction) destroyOptions.transaction = options.transaction;
    await ScormRuntimeSnapshot.destroy(destroyOptions);
}

function snapshotState(snapshot) {
    return payloadFromSnapshot(snapshot);
}

module.exports = {
    defaultState,
    normalizeState,
    snapshotState,
    load,
    save,
    destroy,
    projectLegacy,
    STATE_KEYS
};
