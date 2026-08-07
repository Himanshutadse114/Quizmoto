/**
 * SCORM 1.2 LMS Runtime — server-backed CMI store.
 */
const {
    ScormRegistration,
    ScormAttempt,
    ScormCmiState,
    ScormCourse,
    ScormPackage
} = require('../../models/scorm');
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

function parseTimeToSeconds(t) {
    if (!t || typeof t !== 'string') return 0;
    const m = t.trim().match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
    if (!m) return 0;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const s = parseInt(m[3], 10);
    const frac = m[4] ? parseInt(m[4].padEnd(2, '0').slice(0, 2), 10) / 100 : 0;
    return h * 3600 + min * 60 + s + frac;
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

async function loadRegAuthorized(regId, token) {
    const decoded = verifyRegistrationToken(token);
    if (decoded.scormRegId !== regId) {
        const err = new Error('Token does not match registration');
        err.code = 'FORBIDDEN';
        throw err;
    }
    const reg = await ScormRegistration.findByPk(regId, {
        include: [{ model: ScormCourse, as: 'course', include: [{ model: ScormPackage, as: 'package' }] }]
    });
    if (!reg || reg.status === 'revoked') {
        const err = new Error('Registration not found or revoked');
        err.code = 'NOT_FOUND';
        throw err;
    }
    return reg;
}

async function getOrCreateState(reg) {
    let state = await ScormCmiState.findOne({ where: { registrationId: reg.id } });
    if (!state) {
        state = await ScormCmiState.create({
            registrationId: reg.id,
            lessonStatus: 'not attempted',
            totalTime: '00:00:00.00',
            sessionTime: '00:00:00.00',
            stateVersion: 0,
            initialized: false
        });
    }
    return state;
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

async function initialize(regId, token) {
    const reg = await loadRegAuthorized(regId, token);
    const state = await getOrCreateState(reg);

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
        (state.lessonStatus && state.lessonStatus !== 'not attempted' && state.lessonStatus !== 'completed' && state.lessonStatus !== 'passed' && state.lessonStatus !== 'failed');
    state.entry = resume ? 'resume' : 'ab-initio';
    state.sessionTime = '00:00:00.00';
    state.initialized = true;
    await state.save();

    if (reg.status === 'invited') {
        reg.status = 'active';
        await reg.save();
    }

    return { ok: true, value: 'true', errorCode: 0, entry: state.entry, stateVersion: state.stateVersion };
}

async function getValue(regId, token, element) {
    const reg = await loadRegAuthorized(regId, token);
    const state = await getOrCreateState(reg);
    if (!state.initialized) {
        return { ok: false, value: '', errorCode: 301 };
    }

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
        'cmi.suspend_data': state.suspendData || '',
        'cmi.core.score._children': 'raw,min,max'
    };

    if (Object.prototype.hasOwnProperty.call(builtIn, el)) {
        return { ok: true, value: builtIn[el], errorCode: 0 };
    }
    if (Object.prototype.hasOwnProperty.call(map, el)) {
        return { ok: true, value: String(map[el]), errorCode: 0 };
    }
    return { ok: true, value: '', errorCode: 0 };
}

async function setValue(regId, token, element, value) {
    const reg = await loadRegAuthorized(regId, token);
    const state = await getOrCreateState(reg);
    if (!state.initialized) {
        return { ok: false, value: 'false', errorCode: 301 };
    }

    const el = String(element || '');
    const val = value == null ? '' : String(value);

    const readOnly = new Set([
        'cmi.core.student_id',
        'cmi.core.student_name',
        'cmi.core.credit',
        'cmi.core.entry',
        'cmi.core.total_time',
        'cmi.core.lesson_mode',
        'cmi.core._children',
        'cmi.core.score._children'
    ]);
    if (readOnly.has(el)) {
        return { ok: false, value: 'false', errorCode: 403 };
    }

    if (el === 'cmi.core.lesson_status') {
        if (!LESSON_STATUS.has(val)) {
            return { ok: false, value: 'false', errorCode: 405 };
        }
        state.lessonStatus = val;
    } else if (el === 'cmi.core.score.raw') {
        const n = Number(val);
        if (Number.isNaN(n)) return { ok: false, value: 'false', errorCode: 405 };
        state.scoreRaw = n;
    } else if (el === 'cmi.core.score.min') {
        const n = Number(val);
        if (Number.isNaN(n)) return { ok: false, value: 'false', errorCode: 405 };
        state.scoreMin = n;
    } else if (el === 'cmi.core.score.max') {
        const n = Number(val);
        if (Number.isNaN(n)) return { ok: false, value: 'false', errorCode: 405 };
        state.scoreMax = n;
    } else if (el === 'cmi.core.lesson_location') {
        state.lessonLocation = val.slice(0, 1000);
    } else if (el === 'cmi.core.session_time') {
        if (parseTimeToSeconds(val) === 0 && val && !/^\d+:\d{2}:\d{2}/.test(val)) {
            return { ok: false, value: 'false', errorCode: 405 };
        }
        state.sessionTime = val;
    } else if (el === 'cmi.core.exit') {
        state.exit = val;
    } else if (el === 'cmi.suspend_data') {
        if (val.length > 65536) return { ok: false, value: 'false', errorCode: 405 };
        state.suspendData = val;
    } else {
        const map = rawMap(state);
        map[el] = val;
        saveRawMap(state, map);
    }

    await state.save();
    return { ok: true, value: 'true', errorCode: 0 };
}

async function commit(regId, token) {
    const reg = await loadRegAuthorized(regId, token);
    const state = await getOrCreateState(reg);
    if (!state.initialized) {
        return { ok: false, value: 'false', errorCode: 301 };
    }

    const sessionSec = parseTimeToSeconds(state.sessionTime);
    const totalSec = parseTimeToSeconds(state.totalTime);
    if (sessionSec > 0) {
        state.totalTime = formatTime(totalSec + sessionSec);
        state.sessionTime = '00:00:00.00';
    }

    state.stateVersion = (state.stateVersion || 0) + 1;
    await state.save();

    reg.lastLessonStatus = state.lessonStatus;
    reg.lastScoreRaw = state.scoreRaw;
    reg.lastTotalTime = state.totalTime;
    reg.lastCommitAt = new Date();
    await reg.save();

    return {
        ok: true,
        value: 'true',
        errorCode: 0,
        stateVersion: state.stateVersion,
        summary: {
            registrationId: reg.id,
            lessonStatus: state.lessonStatus,
            scoreRaw: state.scoreRaw,
            totalTime: state.totalTime,
            updatedAt: reg.lastCommitAt
        }
    };
}

async function finish(regId, token) {
    const commitResult = await commit(regId, token);
    if (!commitResult.ok) return commitResult;

    const reg = await loadRegAuthorized(regId, token);
    const state = await getOrCreateState(reg);

    state.initialized = false;
    await state.save();

    if (state.attemptId) {
        const attempt = await ScormAttempt.findByPk(state.attemptId);
        if (attempt && !attempt.finishedAt) {
            attempt.finishedAt = new Date();
            attempt.exitType = state.exit || 'normal';
            await attempt.save();
        }
    }

    if (['completed', 'passed', 'failed'].includes(state.lessonStatus)) {
        reg.status = 'completed';
        await reg.save();
    }

    return {
        ok: true,
        value: 'true',
        errorCode: 0,
        summary: commitResult.summary
    };
}

function errorString(code) {
    return ERRORS[code] || 'Unknown error';
}

module.exports = {
    initialize,
    getValue,
    setValue,
    commit,
    finish,
    errorString,
    parseTimeToSeconds,
    formatTime,
    ERRORS
};
