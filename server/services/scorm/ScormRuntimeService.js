/**
 * SCORM 1.2 + SCORM 2004 (partial) LMS Runtime.
 *
 * Canonical learner state is persisted as one atomic runtime snapshot per
 * registration. The historical scorm_cmi_states table is now only a
 * best-effort compatibility projection and can never fail LMSCommit/Finish.
 */
const {
    ScormRegistration,
    ScormAttempt
} = require('../../models/scorm');
const RuntimeStore = require('./ScormRuntimeSnapshotStore');
const { verifyRegistrationToken } = require('./ScormInviteService');

const ERRORS = {
    0: 'No error',
    101: 'General exception',
    201: 'Invalid argument error',
    301: 'Not initialized',
    351: 'Not implemented error',
    391: 'Not initialized error',
    402: 'Invalid set value, element is a keyword',
    403: 'Element is read only',
    404: 'Element is write only',
    405: 'Incorrect data type'
};

const LESSON_STATUS = new Set([
    'passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'
]);

const COMPLETION_STATUS = new Set([
    'completed', 'incomplete', 'not attempted', 'unknown'
]);

const SUCCESS_STATUS = new Set([
    'passed', 'failed', 'unknown'
]);

const READ_ONLY = new Set([
    'cmi.core.student_id',
    'cmi.core.student_name',
    'cmi.core.credit',
    'cmi.core.entry',
    'cmi.core.total_time',
    'cmi.core.lesson_mode',
    'cmi.core._children',
    'cmi.core.score._children',
    'cmi.learner_id',
    'cmi.learner_name',
    'cmi.total_time',
    'cmi.entry',
    'cmi.mode',
    'cmi.credit'
]);

// A single backend instance is the supported production topology. Serialize
// mutations per registration so an autosave and an explicit Save/Exit cannot
// overwrite one another with stale snapshots.
const mutationQueues = new Map();

async function withMutationLock(regId, work) {
    const key = String(regId);
    const previous = mutationQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(work);
    mutationQueues.set(key, current);
    try {
        return await current;
    } finally {
        if (mutationQueues.get(key) === current) mutationQueues.delete(key);
    }
}

/** SCORM 1.2 times: HHHH:MM:SS.ss or HH:MM:SS */
function parseTimeToSeconds(t) {
    if (!t || typeof t !== 'string') return 0;
    const trimmed = t.trim();
    if (/^P/i.test(trimmed)) return parseIso8601Duration(trimmed);
    const m = trimmed.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
    if (!m) return 0;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const s = parseInt(m[3], 10);
    const frac = m[4] ? parseInt(m[4].padEnd(2, '0').slice(0, 2), 10) / 100 : 0;
    return h * 3600 + min * 60 + s + frac;
}

/** Parse SCORM 2004 ISO-8601 duration (subset): PnYnMnDTnHnMnS */
function parseIso8601Duration(iso) {
    if (!iso || typeof iso !== 'string') return 0;
    const s = iso.trim().toUpperCase();
    if (s === 'PT' || s === 'P') return 0;
    const re = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
    const m = s.match(re);
    if (!m) return 0;
    const years = parseFloat(m[1] || '0');
    const months = parseFloat(m[2] || '0');
    const days = parseFloat(m[3] || '0');
    const hours = parseFloat(m[4] || '0');
    const mins = parseFloat(m[5] || '0');
    const secs = parseFloat(m[6] || '0');
    return years * 365 * 86400 + months * 30 * 86400 + days * 86400 + hours * 3600 + mins * 60 + secs;
}

function formatTime(seconds) {
    let sec = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(sec / 3600);
    sec -= h * 3600;
    const m = Math.floor(sec / 60);
    sec -= m * 60;
    const whole = Math.floor(sec);
    const frac = Math.round((sec - whole) * 100);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(whole).padStart(2, '0');
    const ff = String(frac).padStart(2, '0');
    return `${hh}:${mm}:${ss}.${ff}`;
}

function deriveLessonStatus(state, map) {
    if (state.lessonStatus && state.lessonStatus !== 'not attempted') return state.lessonStatus;
    const success = map['cmi.success_status'] || '';
    const completion = map['cmi.completion_status'] || '';
    if (success === 'passed') return 'passed';
    if (success === 'failed') return 'failed';
    if (completion === 'completed') return 'completed';
    if (completion === 'incomplete') return 'incomplete';
    return state.lessonStatus || 'not attempted';
}

async function loadRegAuthorized(regId, token) {
    const decoded = verifyRegistrationToken(token);
    if (String(decoded.scormRegId) !== String(regId)) {
        const err = new Error('Token does not match registration');
        err.code = 'FORBIDDEN';
        throw err;
    }
    const reg = await ScormRegistration.findByPk(regId);
    if (!reg || reg.status === 'revoked') {
        const err = new Error('Registration not found or revoked');
        err.code = 'NOT_FOUND';
        throw err;
    }
    return reg;
}

function rawMap(state) {
    try {
        return state.rawMapJson ? JSON.parse(state.rawMapJson) : {};
    } catch {
        return {};
    }
}

function saveRawMap(state, map) {
    state.rawMapJson = JSON.stringify(map);
}

function registrationSnapshot(reg) {
    return {
        id: reg.id,
        courseId: reg.courseId,
        learnerName: reg.learnerName,
        learnerEmail: reg.learnerEmail,
        status: reg.status,
        isPreview: reg.isPreview,
        lastLessonStatus: reg.lastLessonStatus,
        lastScoreRaw: reg.lastScoreRaw,
        lastTotalTime: reg.lastTotalTime,
        lastCommitAt: reg.lastCommitAt,
        updatedAt: reg.updatedAt
    };
}

function queueRegistrationSummary(reg, state, markCompleted = false) {
    reg.lastLessonStatus = state.lessonStatus;
    reg.lastScoreRaw = state.scoreRaw;
    reg.lastTotalTime = state.totalTime;
    reg.lastCommitAt = new Date();
    if (markCompleted && ['completed', 'passed', 'failed'].includes(state.lessonStatus)) {
        reg.status = 'completed';
    }

    setImmediate(() => {
        reg.save().catch((err) => {
            console.warn('[scorm-runtime] registration summary update failed', {
                registrationId: reg.id,
                error: err?.message || String(err),
                dbCode: err?.original?.code || err?.parent?.code || null
            });
        });
    });
}

async function initialize(regId, token) {
    return withMutationLock(regId, async () => {
        const reg = await loadRegAuthorized(regId, token);
        const state = await RuntimeStore.load(reg.id);

        let attempt = await ScormAttempt.findOne({
            where: { registrationId: reg.id },
            order: [['attemptNo', 'DESC']]
        });
        if (!attempt || attempt.finishedAt) {
            const nextNo = attempt ? attempt.attemptNo + 1 : 1;
            attempt = await ScormAttempt.create({
                registrationId: reg.id,
                attemptNo: nextNo,
                startedAt: new Date()
            });
        }

        state.attemptId = attempt.id;
        const resume =
            (state.suspendData && state.suspendData.length > 0) ||
            (state.lessonStatus &&
                state.lessonStatus !== 'not attempted' &&
                state.lessonStatus !== 'completed' &&
                state.lessonStatus !== 'passed' &&
                state.lessonStatus !== 'failed');
        state.entry = resume ? 'resume' : 'ab-initio';
        state.sessionTime = '00:00:00.00';
        state.initialized = true;
        await RuntimeStore.save(reg.id, state);

        if (reg.status === 'invited') {
            reg.status = 'active';
            try {
                await reg.save();
            } catch (err) {
                console.warn('[scorm-runtime] registration activation update failed', {
                    registrationId: reg.id,
                    error: err?.message || String(err)
                });
            }
        }

        return { ok: true, value: 'true', errorCode: 0, entry: state.entry, stateVersion: state.stateVersion };
    });
}

async function getValue(regId, token, element) {
    const reg = await loadRegAuthorized(regId, token);
    const state = await RuntimeStore.load(reg.id);
    if (!state.initialized) return { ok: false, value: '', errorCode: 301 };

    const map = rawMap(state);
    const el = String(element || '');
    const builtIn = {
        'cmi.core._children': 'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
        'cmi.core.student_id': String(reg.id),
        'cmi.core.student_name': reg.learnerName || 'Learner',
        'cmi.core.lesson_location': state.lessonLocation || '',
        'cmi.core.credit': 'credit',
        'cmi.core.lesson_status': state.lessonStatus || 'not attempted',
        'cmi.core.entry': state.entry || 'ab-initio',
        'cmi.core.score.raw': state.scoreRaw != null ? String(state.scoreRaw) : '',
        'cmi.core.score.min': state.scoreMin != null ? String(state.scoreMin) : '',
        'cmi.core.score.max': state.scoreMax != null ? String(state.scoreMax) : '',
        'cmi.core.total_time': state.totalTime || '00:00:00.00',
        'cmi.core.lesson_mode': 'normal',
        'cmi.core.exit': state.exit || '',
        'cmi.core.session_time': state.sessionTime || '00:00:00.00',
        'cmi.core.score._children': 'raw,min,max',
        'cmi.suspend_data': state.suspendData || '',
        'cmi.learner_id': String(reg.id),
        'cmi.learner_name': reg.learnerName || 'Learner',
        'cmi.location': state.lessonLocation || '',
        'cmi.completion_status': map['cmi.completion_status'] || (
            ['completed', 'passed', 'failed'].includes(state.lessonStatus) ? 'completed'
                : state.lessonStatus === 'incomplete' ? 'incomplete'
                    : state.lessonStatus === 'not attempted' ? 'not attempted' : 'unknown'
        ),
        'cmi.success_status': map['cmi.success_status'] || (
            state.lessonStatus === 'passed' ? 'passed'
                : state.lessonStatus === 'failed' ? 'failed' : 'unknown'
        ),
        'cmi.score.raw': state.scoreRaw != null ? String(state.scoreRaw) : '',
        'cmi.score.min': state.scoreMin != null ? String(state.scoreMin) : '',
        'cmi.score.max': state.scoreMax != null ? String(state.scoreMax) : '',
        'cmi.score.scaled': map['cmi.score.scaled'] != null
            ? String(map['cmi.score.scaled'])
            : (state.scoreRaw != null && state.scoreMax ? String(state.scoreRaw / state.scoreMax) : ''),
        'cmi.total_time': state.totalTime || '00:00:00.00',
        'cmi.session_time': state.sessionTime || '00:00:00.00',
        'cmi.entry': state.entry === 'resume' ? 'resume' : 'ab-initio',
        'cmi.mode': 'normal',
        'cmi.credit': 'credit',
        'cmi.exit': state.exit || '',
        'cmi.progress_measure': map['cmi.progress_measure'] || ''
    };

    if (Object.prototype.hasOwnProperty.call(builtIn, el)) return { ok: true, value: builtIn[el], errorCode: 0 };
    if (Object.prototype.hasOwnProperty.call(map, el)) return { ok: true, value: String(map[el]), errorCode: 0 };
    return { ok: true, value: '', errorCode: 0 };
}

/** Apply a CMI value to already-loaded state without hitting the database. */
function applyValueToState(state, map, element, value) {
    const el = String(element || '');
    const val = (value == null ? '' : String(value)).replace(/\u0000/g, '');

    if (READ_ONLY.has(el)) return { ok: false, value: 'false', errorCode: 403 };

    if (el === 'cmi.core.lesson_status') {
        if (!LESSON_STATUS.has(val)) return { ok: false, value: 'false', errorCode: 405 };
        state.lessonStatus = val;
    } else if (el === 'cmi.core.score.raw' || el === 'cmi.score.raw') {
        const n = Number(val);
        if (Number.isNaN(n)) return { ok: false, value: 'false', errorCode: 405 };
        state.scoreRaw = n;
    } else if (el === 'cmi.core.score.min' || el === 'cmi.score.min') {
        const n = Number(val);
        if (Number.isNaN(n)) return { ok: false, value: 'false', errorCode: 405 };
        state.scoreMin = n;
    } else if (el === 'cmi.core.score.max' || el === 'cmi.score.max') {
        const n = Number(val);
        if (Number.isNaN(n)) return { ok: false, value: 'false', errorCode: 405 };
        state.scoreMax = n;
    } else if (el === 'cmi.score.scaled') {
        const n = Number(val);
        if (Number.isNaN(n)) return { ok: false, value: 'false', errorCode: 405 };
        map[el] = val;
        if (state.scoreRaw == null && state.scoreMax != null) state.scoreRaw = Math.round(n * state.scoreMax);
    } else if (el === 'cmi.core.lesson_location' || el === 'cmi.location') {
        state.lessonLocation = val.slice(0, 1000);
    } else if (el === 'cmi.core.session_time' || el === 'cmi.session_time') {
        const secs = parseTimeToSeconds(val);
        if (val && secs === 0 && !/^P/i.test(val) && !/^\d+:\d{2}:\d{2}/.test(val)) {
            return { ok: false, value: 'false', errorCode: 405 };
        }
        state.sessionTime = formatTime(secs);
        if (/^P/i.test(val)) map['cmi.session_time'] = val;
    } else if (el === 'cmi.core.exit' || el === 'cmi.exit') {
        state.exit = val.slice(0, 255);
    } else if (el === 'cmi.suspend_data') {
        // SCORM 2004 can legitimately carry substantially more suspend data
        // than SCORM 1.2. The snapshot store is intentionally large-text backed.
        if (val.length > 1024 * 1024) return { ok: false, value: 'false', errorCode: 405 };
        state.suspendData = val;
    } else if (el === 'cmi.completion_status') {
        if (!COMPLETION_STATUS.has(val)) return { ok: false, value: 'false', errorCode: 405 };
        map[el] = val;
        if (val === 'completed' && state.lessonStatus !== 'passed' && state.lessonStatus !== 'failed') {
            state.lessonStatus = 'completed';
        } else if (val === 'incomplete' && (state.lessonStatus === 'not attempted' || !state.lessonStatus)) {
            state.lessonStatus = 'incomplete';
        }
    } else if (el === 'cmi.success_status') {
        if (!SUCCESS_STATUS.has(val)) return { ok: false, value: 'false', errorCode: 405 };
        map[el] = val;
        if (val === 'passed') state.lessonStatus = 'passed';
        else if (val === 'failed') state.lessonStatus = 'failed';
    } else if (el === 'cmi.progress_measure') {
        const n = Number(val);
        if (Number.isNaN(n) || n < 0 || n > 1) return { ok: false, value: 'false', errorCode: 405 };
        map[el] = val;
    } else {
        // interactions.*, objectives.*, adl.nav.*, comments, preferences, etc.
        map[el] = val;
    }

    return { ok: true, value: 'true', errorCode: 0 };
}

function applyValuesToState(state, map, values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
        return { ok: true, value: 'true', errorCode: 0 };
    }
    for (const [element, value] of Object.entries(values)) {
        const result = applyValueToState(state, map, element, value);
        if (!result.ok) return result;
    }
    return { ok: true, value: 'true', errorCode: 0 };
}

async function setValue(regId, token, element, value) {
    return setValues(regId, token, { [String(element || '')]: value });
}

async function setValues(regId, token, values) {
    return withMutationLock(regId, async () => {
        const reg = await loadRegAuthorized(regId, token);
        const state = await RuntimeStore.load(reg.id);
        if (!state.initialized) return { ok: false, value: 'false', errorCode: 301 };

        const map = rawMap(state);
        const result = applyValuesToState(state, map, values);
        if (!result.ok) return result;
        saveRawMap(state, map);
        await RuntimeStore.save(reg.id, state);
        return result;
    });
}

function rollSessionTime(state) {
    const sessionSec = parseTimeToSeconds(state.sessionTime);
    const totalSec = parseTimeToSeconds(state.totalTime);
    if (sessionSec > 0) {
        state.totalTime = formatTime(totalSec + sessionSec);
        state.sessionTime = '00:00:00.00';
    }
}

async function commit(regId, token, values = null) {
    return withMutationLock(regId, async () => {
        const reg = await loadRegAuthorized(regId, token);
        const state = await RuntimeStore.load(reg.id);
        if (!state.initialized) return { ok: false, value: 'false', errorCode: 301 };

        const map = rawMap(state);
        const applied = applyValuesToState(state, map, values);
        if (!applied.ok) return applied;
        saveRawMap(state, map);
        state.lessonStatus = deriveLessonStatus(state, map);
        rollSessionTime(state);
        state.stateVersion = (state.stateVersion || 0) + 1;

        // This is the only authoritative persistence operation for LMSCommit.
        await RuntimeStore.save(reg.id, state);
        queueRegistrationSummary(reg, state, false);

        return {
            ok: true,
            value: 'true',
            errorCode: 0,
            stateVersion: state.stateVersion,
            registration: registrationSnapshot(reg),
            summary: {
                registrationId: reg.id,
                lessonStatus: state.lessonStatus,
                scoreRaw: state.scoreRaw,
                totalTime: state.totalTime,
                updatedAt: reg.lastCommitAt
            }
        };
    });
}

async function finish(regId, token, values = null) {
    return withMutationLock(regId, async () => {
        const reg = await loadRegAuthorized(regId, token);
        const state = await RuntimeStore.load(reg.id);
        if (!state.initialized) return { ok: false, value: 'false', errorCode: 301 };

        const map = rawMap(state);
        const applied = applyValuesToState(state, map, values);
        if (!applied.ok) return applied;
        saveRawMap(state, map);
        state.lessonStatus = deriveLessonStatus(state, map);
        rollSessionTime(state);
        state.stateVersion = (state.stateVersion || 0) + 1;
        state.initialized = false;

        await RuntimeStore.save(reg.id, state);
        queueRegistrationSummary(reg, state, true);

        if (state.attemptId) {
            setImmediate(async () => {
                try {
                    const attempt = await ScormAttempt.findByPk(state.attemptId);
                    if (attempt && !attempt.finishedAt) {
                        attempt.finishedAt = new Date();
                        attempt.exitType = (state.exit || 'normal').slice(0, 255);
                        await attempt.save();
                    }
                } catch (err) {
                    console.warn('[scorm-runtime] attempt finalization failed', {
                        registrationId: reg.id,
                        attemptId: state.attemptId,
                        error: err?.message || String(err)
                    });
                }
            });
        }

        return {
            ok: true,
            value: 'true',
            errorCode: 0,
            stateVersion: state.stateVersion,
            registration: registrationSnapshot(reg),
            summary: {
                registrationId: reg.id,
                lessonStatus: state.lessonStatus,
                scoreRaw: state.scoreRaw,
                totalTime: state.totalTime,
                updatedAt: reg.lastCommitAt
            }
        };
    });
}

function errorString(code) {
    return ERRORS[code] || 'Unknown error';
}

module.exports = {
    initialize,
    getValue,
    setValue,
    setValues,
    commit,
    finish,
    errorString,
    parseTimeToSeconds,
    parseIso8601Duration,
    formatTime,
    applyValueToState,
    ERRORS
};
