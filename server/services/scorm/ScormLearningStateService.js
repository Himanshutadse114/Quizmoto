const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { ScormRegistration } = require('../../models/scorm');
const { verifyRegistrationToken } = require('./ScormInviteService');

let readyPromise = null;

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
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeStatus(values) {
    const success = firstValue(values, ['cmi.success_status']);
    if (success && ['passed', 'failed'].includes(success.toLowerCase())) return success.toLowerCase();

    const status = firstValue(values, ['cmi.core.lesson_status', 'cmi.completion_status']);
    return status ? status.toLowerCase() : null;
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

function deriveState(values, previous = null) {
    const lessonStatus = normalizeStatus(values) || previous?.lessonStatus || 'not attempted';
    const scoreRaw = finiteNumber(firstValue(values, ['cmi.core.score.raw', 'cmi.score.raw']));
    const lessonLocation = firstValue(values, ['cmi.core.lesson_location', 'cmi.location']);
    const suspendData = firstValue(values, ['cmi.suspend_data']) || '';

    const explicitTotal = firstValue(values, ['cmi.core.total_time', 'cmi.total_time']);
    const sessionTime = firstValue(values, ['cmi.core.session_time', 'cmi.session_time']);
    let totalSeconds = explicitTotal ? secondsFromTime(explicitTotal) : 0;
    if (!explicitTotal && sessionTime) {
        totalSeconds = secondsFromTime(previous?.totalTime || '') + secondsFromTime(sessionTime);
    }
    const totalTime = explicitTotal || (totalSeconds > 0 ? formatScorm12Time(totalSeconds) : previous?.totalTime || '00:00:00.00');

    const progressMeasure = finiteNumber(firstValue(values, ['cmi.progress_measure']));
    const customProgress = finiteNumber(firstValue(values, ['quizmoto.progress', 'quizmoto.progress_percent']));
    let progressPercent = previous?.progressPercent ?? null;
    if (progressMeasure != null && progressMeasure >= 0 && progressMeasure <= 1) {
        progressPercent = Math.round(progressMeasure * 1000) / 10;
    } else if (customProgress != null) {
        progressPercent = Math.max(0, Math.min(100, Math.round(customProgress * 10) / 10));
    } else if (['completed', 'passed', 'failed'].includes(lessonStatus)) {
        progressPercent = 100;
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
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);
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
        updatedAt: row.updated_at || null
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

async function getState(registrationId, token) {
    await authorize(registrationId, token);
    const state = rowToState(await readRow(registrationId));
    if (!state) {
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
            updatedAt: null,
            resume: false
        };
    }
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
        if (['completed', 'passed', 'failed'].includes(String(state.lessonStatus || '').toLowerCase())) {
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

async function saveState(registrationId, token, payload = {}) {
    const reg = await authorize(registrationId, token);
    await ensureReady();

    const values = asPlainObject(payload.values);
    const previous = rowToState(await readRow(registrationId));
    const derived = deriveState(values, previous);
    const stateJson = JSON.stringify(values);
    const replacements = {
        registrationId,
        stateJson,
        lessonStatus: derived.lessonStatus,
        scoreRaw: derived.scoreRaw,
        lessonLocation: derived.lessonLocation,
        suspendData: derived.suspendData,
        totalTime: derived.totalTime,
        progressPercent: derived.progressPercent
    };

    if (sequelize.getDialect() === 'postgres') {
        await sequelize.query(`
            INSERT INTO scorm_learning_state_v2
                (registration_id, state_json, lesson_status, score_raw, lesson_location, suspend_data, total_time, progress_percent, sequence, created_at, updated_at)
            VALUES
                (:registrationId, :stateJson, :lessonStatus, :scoreRaw, :lessonLocation, :suspendData, :totalTime, :progressPercent, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (registration_id) DO UPDATE SET
                state_json = EXCLUDED.state_json,
                lesson_status = EXCLUDED.lesson_status,
                score_raw = EXCLUDED.score_raw,
                lesson_location = EXCLUDED.lesson_location,
                suspend_data = EXCLUDED.suspend_data,
                total_time = EXCLUDED.total_time,
                progress_percent = EXCLUDED.progress_percent,
                sequence = scorm_learning_state_v2.sequence + 1,
                updated_at = CURRENT_TIMESTAMP
        `, { replacements });
    } else {
        await sequelize.query(`
            INSERT INTO scorm_learning_state_v2
                (registration_id, state_json, lesson_status, score_raw, lesson_location, suspend_data, total_time, progress_percent, sequence, created_at, updated_at)
            VALUES
                (:registrationId, :stateJson, :lessonStatus, :scoreRaw, :lessonLocation, :suspendData, :totalTime, :progressPercent, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(registration_id) DO UPDATE SET
                state_json = excluded.state_json,
                lesson_status = excluded.lesson_status,
                score_raw = excluded.score_raw,
                lesson_location = excluded.lesson_location,
                suspend_data = excluded.suspend_data,
                total_time = excluded.total_time,
                progress_percent = excluded.progress_percent,
                sequence = scorm_learning_state_v2.sequence + 1,
                updated_at = CURRENT_TIMESTAMP
        `, { replacements });
    }

    const saved = rowToState(await readRow(registrationId));
    await projectRegistration(reg, saved);
    return {
        ok: true,
        event: String(payload.event || 'commit').slice(0, 40),
        summary: saved
    };
}

async function listByRegistrationIds(registrationIds) {
    const ids = Array.from(new Set((registrationIds || []).filter(Boolean).map(String)));
    if (!ids.length) return new Map();
    await ensureReady();
    const placeholders = ids.map(() => '?').join(',');
    const rows = await sequelize.query(
        `SELECT * FROM scorm_learning_state_v2 WHERE registration_id IN (${placeholders})`,
        { replacements: ids, type: QueryTypes.SELECT }
    );
    const out = new Map();
    for (const row of rows) {
        const state = rowToState(row);
        if (state) out.set(String(state.registrationId), state);
    }
    return out;
}

function resetReadyForTests() {
    readyPromise = null;
}

module.exports = {
    bearer,
    ensureReady,
    authorize,
    getState,
    saveState,
    listByRegistrationIds,
    deriveState,
    rowToState,
    resetReadyForTests
};
