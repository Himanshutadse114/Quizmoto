const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { ScormRegistration } = require('../../models/scorm');
const { verifyRegistrationToken } = require('./ScormInviteService');
const RuntimeStore = require('./ScormRuntimeSnapshotStore');
const RuntimeReader = require('./ScormRuntimeSnapshotReader');

let readyPromise = null;
const FINISHED_STATUSES = new Set(['completed', 'passed', 'failed']);
const EMPTY_STATUSES = new Set(['', 'unknown', 'not attempted', 'not_attempted']);

function bearer(req) {
    const h = req.header('Authorization') || '';
    return h.replace(/^Bearer\s+/i, '').trim();
}

function asPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    const keys = Object.keys(value).slice(0, 1500);
    for (const key of keys) {
        if (!key || key.length > 240) continue;
        const raw = value[key];
        if (raw == null) out[key] = '';
        else if (typeof raw === 'string') out[key] = raw;
        else out[key] = String(raw);
    }
    return out;
}

function firstValue(values, keys) {
    for (const key of keys) {
        const value = values[key];
        if (value != null && String(value).trim() !== '') return String(value).trim();
    }
    return null;
}

function finiteNumber(value) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function cleanStatus(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeStatus(values) {
    const candidates = [
        firstValue(values, ['cmi.success_status']),
        firstValue(values, ['cmi.core.lesson_status']),
        firstValue(values, ['cmi.completion_status'])
    ].map(cleanStatus);

    // The LMS player exposes defaults for SCORM 1.2 and SCORM 2004 at the same
    // time. A default "not attempted" from one standard must never hide a valid
    // completion from the other standard.
    for (const status of candidates) {
        if (FINISHED_STATUSES.has(status)) return status;
    }
    for (const status of candidates) {
        if (status && !EMPTY_STATUSES.has(status)) return status;
    }
    return candidates.find(Boolean) || null;
}

function parseScorm12Time(value) {
    const match = String(value || '').trim().match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (![hours, minutes, seconds].every(Number.isFinite)) return null;
    return hours * 3600 + minutes * 60 + seconds;
}

function parseIsoDuration(value) {
    const match = String(value || '').trim().match(/^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/i);
    if (!match) return null;
    const days = Number(match[1] || 0);
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    const seconds = Number(match[4] || 0);
    if (![days, hours, minutes, seconds].every(Number.isFinite)) return null;
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function secondsFromTime(value) {
    return parseScorm12Time(value) ?? parseIsoDuration(value) ?? 0;
}

function formatScorm12Time(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = (total % 60).toFixed(2).padStart(5, '0');
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secs}`;
}

function suspendProgress(values) {
    const raw = firstValue(values, ['cmi.suspend_data']);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return finiteNumber(parsed?.quizmotoProgress ?? parsed?.progressPercent ?? parsed?.progress);
    } catch (_) {
        return null;
    }
}

function deriveState(values, previous = null) {
    const lessonStatus = normalizeStatus(values) || previous?.lessonStatus || 'not attempted';
    const scoreRaw = finiteNumber(firstValue(values, ['cmi.core.score.raw', 'cmi.score.raw']));
    const lessonLocation = firstValue(values, ['cmi.core.lesson_location', 'cmi.location']);
    const suspendData = firstValue(values, ['cmi.suspend_data']) || previous?.suspendData || '';

    const absoluteSeconds = finiteNumber(firstValue(values, ['quizmoto.total_time_seconds']));
    const explicitTotal = firstValue(values, ['cmi.core.total_time', 'cmi.total_time']);
    const sessionTime = firstValue(values, ['cmi.core.session_time', 'cmi.session_time']);
    const explicitSeconds = secondsFromTime(explicitTotal);
    const previousSeconds = secondsFromTime(previous?.totalTime || '');
    const sessionSeconds = secondsFromTime(sessionTime);
    let totalTime;
    if (absoluteSeconds != null && absoluteSeconds >= 0) {
        // LMSGEN's player shell supplies an absolute cumulative clock. This
        // makes time tracking idempotent across autosave retries and prevents a
        // package that repeatedly reports cumulative session_time from being
        // added more than once.
        totalTime = formatScorm12Time(absoluteSeconds);
    } else if (explicitTotal && explicitSeconds > 0) {
        totalTime = explicitTotal;
    } else if (sessionSeconds > 0) {
        totalTime = formatScorm12Time(previousSeconds + sessionSeconds);
    } else {
        totalTime = previous?.totalTime || explicitTotal || '00:00:00.00';
    }

    const progressMeasure = finiteNumber(firstValue(values, ['cmi.progress_measure']));
    const customProgress = finiteNumber(firstValue(values, ['quizmoto.progress', 'quizmoto.progress_percent']));
    const suspendedProgress = suspendProgress(values);
    let progressPercent = previous?.progressPercent ?? null;
    if (FINISHED_STATUSES.has(cleanStatus(lessonStatus))) {
        progressPercent = 100;
    } else if (progressMeasure != null && progressMeasure >= 0 && progressMeasure <= 1) {
        progressPercent = Math.round(progressMeasure * 1000) / 10;
    } else if (customProgress != null) {
        progressPercent = Math.max(0, Math.min(100, Math.round(customProgress * 10) / 10));
    } else if (suspendedProgress != null) {
        progressPercent = Math.max(0, Math.min(100, Math.round(suspendedProgress * 10) / 10));
    }

    return {
        lessonStatus,
        scoreRaw: scoreRaw != null ? scoreRaw : previous?.scoreRaw ?? null,
        lessonLocation: lessonLocation || previous?.lessonLocation || null,
        suspendData,
        totalTime,
        progressPercent
    };
}

async function ensureReady() {
    if (!readyPromise) {
        readyPromise = (async () => {
            const dialect = sequelize.getDialect();
            if (dialect === 'postgres') {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS scorm_learning_state_v2 (
                        registration_id UUID PRIMARY KEY,
                        state_json TEXT NOT NULL DEFAULT '{}',
                        lesson_status TEXT,
                        score_raw DOUBLE PRECISION,
                        lesson_location TEXT,
                        suspend_data TEXT,
                        total_time TEXT,
                        progress_percent DOUBLE PRECISION,
                        sequence BIGINT NOT NULL DEFAULT 0,
                        client_revision BIGINT NOT NULL DEFAULT 0,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                const additions = [
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS state_json TEXT NOT NULL DEFAULT '{}'`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS lesson_status TEXT`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS score_raw DOUBLE PRECISION`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS lesson_location TEXT`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS suspend_data TEXT`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS total_time TEXT`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS progress_percent DOUBLE PRECISION`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS sequence BIGINT NOT NULL DEFAULT 0`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS client_revision BIGINT NOT NULL DEFAULT 0`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
                    `ALTER TABLE scorm_learning_state_v2 ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
                ];
                for (const sql of additions) await sequelize.query(sql);
            } else {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS scorm_learning_state_v2 (
                        registration_id TEXT PRIMARY KEY,
                        state_json TEXT NOT NULL DEFAULT '{}',
                        lesson_status TEXT,
                        score_raw REAL,
                        lesson_location TEXT,
                        suspend_data TEXT,
                        total_time TEXT,
                        progress_percent REAL,
                        sequence INTEGER NOT NULL DEFAULT 0,
                        client_revision INTEGER NOT NULL DEFAULT 0,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                try {
                    await sequelize.query('ALTER TABLE scorm_learning_state_v2 ADD COLUMN client_revision INTEGER NOT NULL DEFAULT 0');
                } catch (_) {
                    // SQLite has no ADD COLUMN IF NOT EXISTS; an existing column is fine.
                }
            }
        })().catch((err) => {
            readyPromise = null;
            throw err;
        });
    }
    await readyPromise;
}

async function authorize(registrationId, token) {
    const decoded = verifyRegistrationToken(token);
    if (String(decoded.scormRegId) !== String(registrationId)) {
        const err = new Error('Token does not match registration');
        err.code = 'FORBIDDEN';
        throw err;
    }
    const reg = await ScormRegistration.findByPk(registrationId);
    if (!reg || reg.status === 'revoked') {
        const err = new Error('Registration not found or revoked');
        err.code = 'NOT_FOUND';
        throw err;
    }
    return reg;
}

function rowToState(row) {
    if (!row) return null;
    let values = {};
    try {
        values = typeof row.state_json === 'string' ? JSON.parse(row.state_json) : row.state_json || {};
    } catch (_) {
        values = {};
    }
    return {
        registrationId: row.registration_id,
        values: asPlainObject(values),
        lessonStatus: row.lesson_status || null,
        scoreRaw: row.score_raw != null ? Number(row.score_raw) : null,
        lessonLocation: row.lesson_location || null,
        suspendData: row.suspend_data || '',
        totalTime: row.total_time || '00:00:00.00',
        progressPercent: row.progress_percent != null ? Number(row.progress_percent) : null,
        sequence: Number(row.sequence || 0),
        clientRevision: Number(row.client_revision || 0),
        updatedAt: row.updated_at || null
    };
}

function runtimeToState(registrationId, runtime) {
    if (!runtime) return null;
    let values = {};
    try {
        values = typeof runtime.rawMapJson === 'string' ? JSON.parse(runtime.rawMapJson) : runtime.rawMapJson || {};
    } catch (_) {
        values = {};
    }
    const derived = deriveState(asPlainObject(values), {
        lessonStatus: runtime.lessonStatus,
        scoreRaw: runtime.scoreRaw,
        lessonLocation: runtime.lessonLocation,
        suspendData: runtime.suspendData,
        totalTime: runtime.totalTime,
        progressPercent: null
    });
    return {
        registrationId,
        values: asPlainObject(values),
        lessonStatus: derived.lessonStatus,
        scoreRaw: derived.scoreRaw,
        lessonLocation: derived.lessonLocation,
        suspendData: derived.suspendData,
        totalTime: derived.totalTime,
        progressPercent: derived.progressPercent,
        sequence: Number(runtime.stateVersion || 0),
        clientRevision: Number(runtime.stateVersion || 0),
        updatedAt: runtime.updatedAt || null
    };
}

async function readRow(registrationId) {
    await ensureReady();
    const rows = await sequelize.query(
        'SELECT * FROM scorm_learning_state_v2 WHERE registration_id = :registrationId LIMIT 1',
        {
            replacements: { registrationId },
            type: QueryTypes.SELECT
        }
    );
    return rows[0] || null;
}

function hasActivity(state) {
    if (!state) return false;
    return Boolean(
        Number(state.sequence || 0) > 0 ||
        state.lessonLocation ||
        state.suspendData ||
        state.scoreRaw != null ||
        (state.lessonStatus && !EMPTY_STATUSES.has(cleanStatus(state.lessonStatus)))
    );
}

function emptyState(registrationId) {
    return {
        registrationId,
        values: {},
        lessonStatus: 'not attempted',
        scoreRaw: null,
        lessonLocation: null,
        suspendData: '',
        totalTime: '00:00:00.00',
        progressPercent: 0,
        sequence: 0,
        clientRevision: 0,
        updatedAt: null,
        resume: false
    };
}

async function getState(registrationId, token) {
    await authorize(registrationId, token);
    let state = null;
    try {
        state = rowToState(await readRow(registrationId));
    } catch (err) {
        console.warn('[scorm-state-v2] primary state read failed; using runtime snapshot', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
    }

    if (!hasActivity(state)) {
        try {
            const runtimeState = runtimeToState(registrationId, await RuntimeStore.load(registrationId));
            if (hasActivity(runtimeState)) state = runtimeState;
        } catch (err) {
            console.warn('[scorm-state-v2] runtime fallback read failed', {
                registrationId,
                error: err?.message || String(err)
            });
        }
    }

    if (!state) return emptyState(registrationId);
    const resume = Boolean(
        state.lessonLocation ||
        state.suspendData ||
        (state.lessonStatus && state.lessonStatus !== 'not attempted') ||
        state.sequence > 0
    );
    return { ...state, resume };
}

async function projectRegistration(reg, state) {
    try {
        if (state.lessonStatus) reg.lastLessonStatus = state.lessonStatus;
        if (state.scoreRaw != null) reg.lastScoreRaw = state.scoreRaw;
        if (state.totalTime) reg.lastTotalTime = state.totalTime;
        reg.lastCommitAt = new Date();
        if (FINISHED_STATUSES.has(cleanStatus(state.lessonStatus))) {
            reg.status = 'completed';
        } else if (reg.status === 'invited') {
            reg.status = 'active';
        }
        await reg.save();
    } catch (err) {
        console.warn('[scorm-state-v2] roster projection skipped', {
            registrationId: reg.id,
            error: err?.message || String(err)
        });
    }
}

async function persistDocument(registrationId, payload = {}) {
    await ensureReady();
    const values = asPlainObject(payload.values);
    const previous = rowToState(await readRow(registrationId));
    const derived = deriveState(values, previous);
    const requestedRevision = Math.max(0, Math.floor(Number(payload.clientRevision) || 0));
    const clientRevision = requestedRevision || Math.max(1, Number(previous?.clientRevision || 0) + 1);
    const replacements = {
        registrationId,
        stateJson: JSON.stringify(values),
        lessonStatus: derived.lessonStatus,
        scoreRaw: derived.scoreRaw,
        lessonLocation: derived.lessonLocation,
        suspendData: derived.suspendData,
        totalTime: derived.totalTime,
        progressPercent: derived.progressPercent,
        clientRevision
    };

    if (sequelize.getDialect() === 'postgres') {
        await sequelize.query(`
            INSERT INTO scorm_learning_state_v2
                (registration_id, state_json, lesson_status, score_raw, lesson_location, suspend_data, total_time, progress_percent, sequence, client_revision, created_at, updated_at)
            VALUES
                (:registrationId, :stateJson, :lessonStatus, :scoreRaw, :lessonLocation, :suspendData, :totalTime, :progressPercent, 1, :clientRevision, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (registration_id) DO UPDATE SET
                state_json = EXCLUDED.state_json,
                lesson_status = EXCLUDED.lesson_status,
                score_raw = EXCLUDED.score_raw,
                lesson_location = EXCLUDED.lesson_location,
                suspend_data = EXCLUDED.suspend_data,
                total_time = EXCLUDED.total_time,
                progress_percent = EXCLUDED.progress_percent,
                sequence = scorm_learning_state_v2.sequence + 1,
                client_revision = EXCLUDED.client_revision,
                updated_at = CURRENT_TIMESTAMP
            WHERE EXCLUDED.client_revision >= scorm_learning_state_v2.client_revision
        `, { replacements });
    } else {
        await sequelize.query(`
            INSERT INTO scorm_learning_state_v2
                (registration_id, state_json, lesson_status, score_raw, lesson_location, suspend_data, total_time, progress_percent, sequence, client_revision, created_at, updated_at)
            VALUES
                (:registrationId, :stateJson, :lessonStatus, :scoreRaw, :lessonLocation, :suspendData, :totalTime, :progressPercent, 1, :clientRevision, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(registration_id) DO UPDATE SET
                state_json = excluded.state_json,
                lesson_status = excluded.lesson_status,
                score_raw = excluded.score_raw,
                lesson_location = excluded.lesson_location,
                suspend_data = excluded.suspend_data,
                total_time = excluded.total_time,
                progress_percent = excluded.progress_percent,
                sequence = scorm_learning_state_v2.sequence + 1,
                client_revision = excluded.client_revision,
                updated_at = CURRENT_TIMESTAMP
            WHERE excluded.client_revision >= scorm_learning_state_v2.client_revision
        `, { replacements });
    }

    return rowToState(await readRow(registrationId));
}

async function mirrorRuntime(registrationId, values, saved, clientRevision = 0) {
    try {
        const current = await RuntimeStore.load(registrationId);
        const nextVersion = Math.max(
            Number(current?.stateVersion || 0) + 1,
            Number(saved?.sequence || 0),
            Math.max(0, Math.floor(Number(clientRevision) || 0))
        );
        await RuntimeStore.save(registrationId, {
            ...current,
            lessonStatus: saved?.lessonStatus || current?.lessonStatus || 'not attempted',
            scoreRaw: saved?.scoreRaw != null ? saved.scoreRaw : current?.scoreRaw ?? null,
            scoreMin: finiteNumber(firstValue(values, ['cmi.core.score.min', 'cmi.score.min'])) ?? current?.scoreMin ?? null,
            scoreMax: finiteNumber(firstValue(values, ['cmi.core.score.max', 'cmi.score.max'])) ?? current?.scoreMax ?? null,
            lessonLocation: saved?.lessonLocation || current?.lessonLocation || null,
            suspendData: saved?.suspendData || current?.suspendData || '',
            exit: firstValue(values, ['cmi.core.exit', 'cmi.exit']) || current?.exit || '',
            totalTime: saved?.totalTime || current?.totalTime || '00:00:00.00',
            sessionTime: firstValue(values, ['cmi.core.session_time', 'cmi.session_time']) || current?.sessionTime || '00:00:00.00',
            rawMapJson: JSON.stringify(asPlainObject(values)),
            stateVersion: nextVersion,
            initialized: true
        });
        return true;
    } catch (err) {
        console.warn('[scorm-state-v2] runtime mirror failed', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        return false;
    }
}

async function saveFallback(registrationId, reg, payload, primaryError) {
    const values = asPlainObject(payload.values);
    let previous = null;
    let currentRuntime = null;
    try {
        currentRuntime = await RuntimeStore.load(registrationId);
        previous = runtimeToState(registrationId, currentRuntime);
    } catch (_) {
        previous = null;
    }
    const derived = deriveState(values, previous);
    const requestedRevision = Math.max(0, Math.floor(Number(payload.clientRevision) || 0));
    const nextVersion = Math.max(Number(currentRuntime?.stateVersion || 0) + 1, requestedRevision || 1);
    const saved = {
        registrationId,
        values,
        ...derived,
        sequence: nextVersion,
        clientRevision: requestedRevision || nextVersion,
        updatedAt: new Date().toISOString()
    };

    await RuntimeStore.save(registrationId, {
        ...(currentRuntime || RuntimeStore.defaultState()),
        lessonStatus: saved.lessonStatus,
        scoreRaw: saved.scoreRaw,
        scoreMin: finiteNumber(firstValue(values, ['cmi.core.score.min', 'cmi.score.min'])),
        scoreMax: finiteNumber(firstValue(values, ['cmi.core.score.max', 'cmi.score.max'])),
        lessonLocation: saved.lessonLocation,
        suspendData: saved.suspendData,
        exit: firstValue(values, ['cmi.core.exit', 'cmi.exit']) || '',
        totalTime: saved.totalTime,
        sessionTime: firstValue(values, ['cmi.core.session_time', 'cmi.session_time']) || '00:00:00.00',
        rawMapJson: JSON.stringify(values),
        stateVersion: nextVersion,
        initialized: true
    });
    await projectRegistration(reg, saved);
    console.warn('[scorm-state-v2] primary state write failed; runtime snapshot accepted the commit', {
        registrationId,
        error: primaryError?.message || String(primaryError),
        dbCode: primaryError?.original?.code || primaryError?.parent?.code || null
    });
    return saved;
}

async function saveState(registrationId, token, payload = {}) {
    const reg = await authorize(registrationId, token);
    const values = asPlainObject(payload.values);
    let saved;
    let degraded = false;
    try {
        saved = await persistDocument(registrationId, { ...payload, values });
        await projectRegistration(reg, saved);
        await mirrorRuntime(registrationId, values, saved, payload.clientRevision);
    } catch (err) {
        degraded = true;
        saved = await saveFallback(registrationId, reg, { ...payload, values }, err);
    }
    return {
        ok: true,
        degraded,
        event: String(payload.event || 'commit').slice(0, 40),
        summary: saved
    };
}

async function listByRegistrationIds(registrationIds) {
    const ids = Array.from(new Set((registrationIds || []).filter(Boolean).map(String)));
    if (!ids.length) return new Map();
    const out = new Map();
    try {
        await ensureReady();
        const rows = await sequelize.query(
            'SELECT * FROM scorm_learning_state_v2 WHERE registration_id IN (:registrationIds)',
            {
                replacements: { registrationIds: ids },
                type: QueryTypes.SELECT
            }
        );
        for (const row of rows) {
            const state = rowToState(row);
            if (state) out.set(String(state.registrationId), state);
        }
    } catch (err) {
        console.warn('[scorm-state-v2] primary state list failed; reading runtime snapshots', {
            registrations: ids.length,
            error: err?.message || String(err)
        });
    }

    const missing = ids.filter((id) => !out.has(id));
    if (missing.length) {
        const runtimeStates = await RuntimeReader.listByRegistrationIds(missing);
        for (const [id, runtime] of runtimeStates.entries()) {
            const state = runtimeToState(id, runtime);
            if (state && hasActivity(state)) out.set(String(id), state);
        }
    }
    return out;
}

async function destroyState(registrationId) {
    try {
        await ensureReady();
        await sequelize.query(
            'DELETE FROM scorm_learning_state_v2 WHERE registration_id = :registrationId',
            { replacements: { registrationId } }
        );
    } catch (err) {
        console.warn('[scorm-state-v2] primary state delete skipped', {
            registrationId,
            error: err?.message || String(err)
        });
    }
    try {
        await RuntimeStore.destroy(registrationId);
    } catch (_) {
        // Registration deletion should not fail because a compatibility snapshot is unavailable.
    }
}

function resetReadyForTests() {
    readyPromise = null;
    if (typeof RuntimeStore.resetReadyForTests === 'function') RuntimeStore.resetReadyForTests();
}

module.exports = {
    bearer,
    ensureReady,
    authorize,
    getState,
    saveState,
    persistDocument,
    destroyState,
    listByRegistrationIds,
    deriveState,
    rowToState,
    runtimeToState,
    normalizeStatus,
    resetReadyForTests
};