const { ScormRegistration } = require('../../models/scorm');
const { verifyRegistrationToken } = require('./ScormInviteService');
const RuntimeStore = require('./ScormRuntimeSnapshotStore');
const RuntimeReader = require('./ScormRuntimeSnapshotReader');

const FINISHED_STATUSES = new Set(['completed', 'passed', 'failed']);
const EMPTY_STATUSES = new Set(['', 'unknown', 'not attempted', 'not_attempted']);

function bearer(req) {
    const header = req.header('Authorization') || '';
    return header.replace(/^Bearer\s+/i, '').trim();
}

function asPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const key of Object.keys(value).slice(0, 1500)) {
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
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
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

function runtimeValues(runtime) {
    if (!runtime) return {};
    try {
        return asPlainObject(typeof runtime.rawMapJson === 'string'
            ? JSON.parse(runtime.rawMapJson || '{}')
            : runtime.rawMapJson || {});
    } catch (_) {
        return {};
    }
}

function runtimeToState(registrationId, runtime) {
    if (!runtime) return null;
    const values = runtimeValues(runtime);
    const derived = deriveState(values, {
        lessonStatus: runtime.lessonStatus,
        scoreRaw: runtime.scoreRaw,
        lessonLocation: runtime.lessonLocation,
        suspendData: runtime.suspendData,
        totalTime: runtime.totalTime,
        progressPercent: null
    });
    const version = Math.max(0, Number(runtime.stateVersion || 0));
    return {
        registrationId: String(registrationId),
        values,
        lessonStatus: derived.lessonStatus,
        scoreRaw: derived.scoreRaw,
        lessonLocation: derived.lessonLocation,
        suspendData: derived.suspendData,
        totalTime: derived.totalTime,
        progressPercent: derived.progressPercent,
        sequence: version,
        clientRevision: version,
        updatedAt: runtime.updatedAt || null
    };
}

function rowToState(row) {
    if (!row) return null;
    if (row.registrationId || row.registration_id) {
        return runtimeToState(row.registrationId || row.registration_id, row);
    }
    return null;
}

function hasActivity(state) {
    if (!state) return false;
    return Boolean(
        Number(state.sequence || 0) > 0 ||
        state.lessonLocation ||
        state.suspendData ||
        state.scoreRaw != null ||
        secondsFromTime(state.totalTime) > 0 ||
        (state.lessonStatus && !EMPTY_STATUSES.has(cleanStatus(state.lessonStatus)))
    );
}

function hasResumeActivity(state) {
    if (!state) return false;
    if (state.lessonLocation || state.suspendData || state.scoreRaw != null) return true;
    if (secondsFromTime(state.totalTime) > 0.5) return true;
    if (Number(state.progressPercent || 0) > 0) return true;
    if (FINISHED_STATUSES.has(cleanStatus(state.lessonStatus))) return true;
    return Number(state.sequence || 0) > 1;
}

function emptyState(registrationId) {
    return {
        registrationId: String(registrationId),
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

async function ensureReady() {
    await RuntimeStore.ensureReady();
}

async function authorize(registrationId, token) {
    const decoded = verifyRegistrationToken(token);
    if (String(decoded.scormRegId) !== String(registrationId)) {
        const err = new Error('Token does not match registration');
        err.code = 'FORBIDDEN';
        throw err;
    }
    const registration = await ScormRegistration.findByPk(registrationId);
    if (!registration || registration.status === 'revoked') {
        const err = new Error('Registration not found or revoked');
        err.code = 'NOT_FOUND';
        throw err;
    }
    return registration;
}

async function projectRegistration(registration, state) {
    try {
        if (state.lessonStatus) registration.lastLessonStatus = state.lessonStatus;
        if (state.scoreRaw != null) registration.lastScoreRaw = state.scoreRaw;
        if (state.totalTime) registration.lastTotalTime = state.totalTime;
        registration.lastCommitAt = new Date();
        if (FINISHED_STATUSES.has(cleanStatus(state.lessonStatus))) {
            registration.status = 'completed';
        } else if (registration.status === 'invited') {
            registration.status = 'active';
        }
        await registration.save();
    } catch (err) {
        console.warn('[scorm-tracking] registration projection skipped', {
            registrationId: registration.id,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
    }
}

function launchValues(previousState) {
    const values = { ...(previousState?.values || {}) };
    const coreStatus = cleanStatus(values['cmi.core.lesson_status']);
    const completionStatus = cleanStatus(values['cmi.completion_status']);

    if (!coreStatus || EMPTY_STATUSES.has(coreStatus)) values['cmi.core.lesson_status'] = 'incomplete';
    if (!completionStatus || EMPTY_STATUSES.has(completionStatus)) values['cmi.completion_status'] = 'incomplete';
    values['quizmoto.launch_marker'] = '1';
    values['quizmoto.total_time_seconds'] = String(secondsFromTime(previousState?.totalTime || '00:00:00.00'));
    return values;
}

async function persistDocument(registrationId, payload = {}) {
    await ensureReady();
    const currentRuntime = await RuntimeStore.load(registrationId);
    const previous = runtimeToState(registrationId, currentRuntime) || emptyState(registrationId);
    const values = asPlainObject(payload.values);
    const requestedRevision = Math.max(0, Math.floor(Number(payload.clientRevision) || 0));
    const currentVersion = Math.max(0, Number(currentRuntime?.stateVersion || 0));

    // A browser tab that is behind the server state may not overwrite a newer
    // commit. It receives the current canonical document and will continue from it.
    if (requestedRevision > 0 && requestedRevision < currentVersion) {
        return previous;
    }

    const derived = deriveState(values, previous);
    const nextVersion = Math.max(currentVersion + 1, requestedRevision || 0, 1);
    const event = String(payload.event || 'commit').toLowerCase();
    const finished = event === 'finish' || event === 'terminate' || event === 'exit';

    const savedRuntime = await RuntimeStore.save(registrationId, {
        ...currentRuntime,
        lessonStatus: derived.lessonStatus,
        scoreRaw: derived.scoreRaw,
        scoreMin: finiteNumber(firstValue(values, ['cmi.core.score.min', 'cmi.score.min'])) ?? currentRuntime?.scoreMin ?? null,
        scoreMax: finiteNumber(firstValue(values, ['cmi.core.score.max', 'cmi.score.max'])) ?? currentRuntime?.scoreMax ?? null,
        lessonLocation: derived.lessonLocation,
        suspendData: derived.suspendData,
        entry: firstValue(values, ['cmi.core.entry', 'cmi.entry']) || currentRuntime?.entry || 'ab-initio',
        exit: firstValue(values, ['cmi.core.exit', 'cmi.exit']) || currentRuntime?.exit || '',
        totalTime: derived.totalTime,
        sessionTime: firstValue(values, ['cmi.core.session_time', 'cmi.session_time']) || currentRuntime?.sessionTime || '00:00:00.00',
        rawMapJson: JSON.stringify(values),
        stateVersion: nextVersion,
        initialized: finished ? false : true
    });

    return runtimeToState(registrationId, savedRuntime);
}

async function getState(registrationId, token) {
    const registration = await authorize(registrationId, token);
    await ensureReady();

    let runtime;
    try {
        runtime = await RuntimeStore.load(registrationId);
    } catch (err) {
        console.error('[scorm-tracking] canonical state load failed', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        const fallback = emptyState(registrationId);
        fallback.values = launchValues(fallback);
        fallback.lessonStatus = 'incomplete';
        return fallback;
    }

    const beforeLaunch = runtimeToState(registrationId, runtime) || emptyState(registrationId);
    const resume = hasResumeActivity(beforeLaunch);
    let state = beforeLaunch;

    try {
        state = await persistDocument(registrationId, {
            event: 'launch',
            clientRevision: Math.max(1, Number(beforeLaunch.clientRevision || 0) + 1),
            values: launchValues(beforeLaunch)
        });
        await projectRegistration(registration, state);
    } catch (err) {
        console.warn('[scorm-tracking] launch touch could not be persisted yet', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        state = {
            ...beforeLaunch,
            values: launchValues(beforeLaunch),
            lessonStatus: EMPTY_STATUSES.has(cleanStatus(beforeLaunch.lessonStatus)) ? 'incomplete' : beforeLaunch.lessonStatus
        };
    }

    return { ...state, resume };
}

async function saveState(registrationId, token, payload = {}) {
    const registration = await authorize(registrationId, token);
    const state = await persistDocument(registrationId, payload);
    await projectRegistration(registration, state);
    return {
        ok: true,
        degraded: false,
        event: String(payload.event || 'commit').slice(0, 40),
        summary: state
    };
}

async function listByRegistrationIds(registrationIds) {
    const ids = Array.from(new Set((registrationIds || []).filter(Boolean).map(String)));
    const output = new Map();
    if (!ids.length) return output;

    const snapshots = await RuntimeReader.listByRegistrationIds(ids);
    for (const [registrationId, runtime] of snapshots.entries()) {
        const state = runtimeToState(registrationId, runtime);
        if (state && hasActivity(state)) output.set(String(registrationId), state);
    }
    return output;
}

async function destroyState(registrationId) {
    try {
        await RuntimeStore.destroy(registrationId);
    } catch (err) {
        console.warn('[scorm-tracking] canonical state delete skipped', {
            registrationId,
            error: err?.message || String(err)
        });
    }
}

function resetReadyForTests() {
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
