const { Op } = require('sequelize');
const { ScormCmiState, ScormRuntimeSnapshot } = require('../../models/scorm');

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

let readyPromise = null;

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
        initialized: false,
        createdAt: null,
        updatedAt: null
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
    state.createdAt = source.createdAt || null;
    state.updatedAt = source.updatedAt || null;
    return state;
}

function snapshotState(snapshot) {
    const row = plain(snapshot);
    if (!row) return null;
    try {
        const parsed = typeof row.payloadJson === 'string' ? JSON.parse(row.payloadJson || '{}') : row.payloadJson;
        return normalizeState({
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
            stateVersion: row.stateVersion ?? parsed?.stateVersion,
            initialized: row.initialized ?? parsed?.initialized,
            createdAt: row.createdAt || parsed?.createdAt || null,
            updatedAt: row.updatedAt || parsed?.updatedAt || null
        });
    } catch (_) {
        return null;
    }
}

function stateActivityScore(state) {
    if (!state) return -1;
    let score = Number(state.stateVersion || 0) * 1000000;
    const updated = new Date(state.updatedAt || 0).getTime();
    if (Number.isFinite(updated)) score += Math.floor(updated / 1000);
    if (state.lessonLocation) score += 100;
    if (state.suspendData) score += 100;
    if (state.scoreRaw != null) score += 100;
    return score;
}

function chooseNewest(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return stateActivityScore(b) > stateActivityScore(a) ? b : a;
}

async function probeModel(model, attributes) {
    try {
        await model.findOne({ attributes, raw: true });
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Supabase migrations can leave one SCORM state table unavailable while the
 * rest of the application database is healthy. Tracking therefore has two
 * compatible persistence targets and only needs one of them to be usable.
 *
 * We deliberately do not depend on a request-time raw CREATE TABLE statement.
 * sequelize.sync() creates both models on normal boots; sync() below is only a
 * repair attempt when a migrated Supabase database is missing one table.
 */
async function ensureReady() {
    if (!readyPromise) {
        readyPromise = (async () => {
            let cmi = await probeModel(ScormCmiState, ['id']);
            let snapshot = await probeModel(ScormRuntimeSnapshot, ['registrationId']);
            const errors = [];

            if (!cmi) {
                try {
                    await ScormCmiState.sync();
                    cmi = true;
                } catch (err) {
                    errors.push(`cmi:${err?.message || err}`);
                }
            }
            if (!snapshot) {
                try {
                    await ScormRuntimeSnapshot.sync();
                    snapshot = true;
                } catch (err) {
                    errors.push(`snapshot:${err?.message || err}`);
                }
            }

            if (!cmi && !snapshot) {
                const err = new Error('No SCORM runtime state table is available');
                err.code = 'SCORM_STATE_STORE_UNAVAILABLE';
                err.details = errors.slice(0, 2);
                throw err;
            }
            return { cmi, snapshot };
        })().catch((err) => {
            readyPromise = null;
            throw err;
        });
    }
    return readyPromise;
}

async function readCmi(registrationId) {
    try {
        const row = await ScormCmiState.findOne({
            where: { registrationId },
            order: [['updatedAt', 'DESC']]
        });
        return row ? normalizeState(row) : null;
    } catch (err) {
        console.warn('[scorm-runtime] CMI read unavailable', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        return null;
    }
}

async function readSnapshot(registrationId) {
    try {
        const row = await ScormRuntimeSnapshot.findByPk(registrationId);
        return snapshotState(row);
    } catch (err) {
        console.warn('[scorm-runtime] snapshot read unavailable', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        return null;
    }
}

async function writeCmi(registrationId, state, options = {}) {
    const normalized = normalizeState(state);
    const values = {};
    for (const key of STATE_KEYS) values[key] = normalized[key];
    values.registrationId = registrationId;

    const transaction = options.transaction;
    let row = await ScormCmiState.findOne({
        where: { registrationId },
        order: [['updatedAt', 'DESC']],
        transaction
    });

    if (!row) {
        try {
            row = await ScormCmiState.create(values, { transaction });
        } catch (err) {
            // A concurrent first commit may have inserted the row after findOne.
            row = await ScormCmiState.findOne({ where: { registrationId }, transaction });
            if (!row) throw err;
        }
    }

    if (row.registrationId) {
        for (const key of STATE_KEYS) row[key] = normalized[key];
        await row.save({ transaction });
    }
    return normalizeState(row);
}

async function writeSnapshot(registrationId, state, options = {}) {
    const normalized = normalizeState(state);
    const payloadJson = JSON.stringify(normalized);
    const transaction = options.transaction;
    let row = await ScormRuntimeSnapshot.findByPk(registrationId, { transaction });

    if (!row) {
        try {
            row = await ScormRuntimeSnapshot.create({
                registrationId,
                payloadJson,
                stateVersion: normalized.stateVersion,
                initialized: normalized.initialized
            }, { transaction });
        } catch (err) {
            row = await ScormRuntimeSnapshot.findByPk(registrationId, { transaction });
            if (!row) throw err;
        }
    } else {
        row.payloadJson = payloadJson;
        row.stateVersion = normalized.stateVersion;
        row.initialized = normalized.initialized;
        await row.save({ transaction });
    }
    return snapshotState(row) || normalized;
}

async function load(registrationId) {
    await ensureReady();
    const [snapshot, cmi] = await Promise.all([
        readSnapshot(registrationId),
        readCmi(registrationId)
    ]);
    const existing = chooseNewest(snapshot, cmi);
    if (existing) return existing;
    return save(registrationId, defaultState(), { projectLegacy: true });
}

async function save(registrationId, state, options = {}) {
    const availability = await ensureReady();
    const normalized = normalizeState(state);
    const successes = [];
    const failures = [];

    if (availability.snapshot) {
        try {
            successes.push(await writeSnapshot(registrationId, normalized, options));
        } catch (err) {
            failures.push(err);
            console.warn('[scorm-runtime] snapshot write failed; using CMI fallback', {
                registrationId,
                error: err?.message || String(err),
                dbCode: err?.original?.code || err?.parent?.code || null
            });
        }
    }

    if (availability.cmi && options.projectLegacy !== false) {
        try {
            successes.push(await writeCmi(registrationId, normalized, options));
        } catch (err) {
            failures.push(err);
            console.warn('[scorm-runtime] CMI write failed; using snapshot fallback', {
                registrationId,
                error: err?.message || String(err),
                dbCode: err?.original?.code || err?.parent?.code || null
            });
        }
    }

    // If the caller disabled the mirror and the snapshot write failed, use the
    // CMI table as the emergency canonical target rather than losing progress.
    if (!successes.length && availability.cmi) {
        try {
            successes.push(await writeCmi(registrationId, normalized, options));
        } catch (err) {
            failures.push(err);
        }
    }

    if (!successes.length) {
        const root = failures[0] || new Error('SCORM runtime write failed');
        root.code = root.code || 'SCORM_STATE_WRITE_FAILED';
        throw root;
    }
    return successes.reduce((best, item) => chooseNewest(best, item), null) || normalized;
}

async function list(registrationIds) {
    const ids = Array.from(new Set((registrationIds || []).filter(Boolean).map(String)));
    const out = new Map();
    if (!ids.length) return out;
    const availability = await ensureReady();

    if (availability.snapshot) {
        try {
            const rows = await ScormRuntimeSnapshot.findAll({ where: { registrationId: { [Op.in]: ids } } });
            for (const row of rows) {
                const state = snapshotState(row);
                if (state) out.set(String(row.registrationId), state);
            }
        } catch (err) {
            console.warn('[scorm-runtime] snapshot batch read failed', { error: err?.message || String(err) });
        }
    }

    if (availability.cmi) {
        try {
            const rows = await ScormCmiState.findAll({ where: { registrationId: { [Op.in]: ids } } });
            for (const row of rows) {
                const state = normalizeState(row);
                const id = String(row.registrationId);
                out.set(id, chooseNewest(out.get(id) || null, state));
            }
        } catch (err) {
            console.warn('[scorm-runtime] CMI batch read failed', { error: err?.message || String(err) });
        }
    }
    return out;
}

async function projectLegacy(registrationId, state, options = {}) {
    try {
        await writeCmi(registrationId, state, options);
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

async function destroy(registrationId, options = {}) {
    const transaction = options.transaction;
    const tasks = [
        ScormRuntimeSnapshot.destroy({ where: { registrationId }, transaction }).catch(() => 0),
        ScormCmiState.destroy({ where: { registrationId }, transaction }).catch(() => 0)
    ];
    await Promise.all(tasks);
}

function resetReadyForTests() {
    readyPromise = null;
}

module.exports = {
    ensureReady,
    defaultState,
    normalizeState,
    snapshotState,
    load,
    save,
    list,
    destroy,
    projectLegacy,
    resetReadyForTests,
    STATE_KEYS
};
