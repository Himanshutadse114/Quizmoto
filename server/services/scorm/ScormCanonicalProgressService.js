const LearningState = require('./ScormLearningStateService');
const { deriveProgress, liveInteractionScore } = require('./ScormProgressService');

const FINISHED_STATUSES = new Set(['completed', 'passed', 'failed']);
const EMPTY_STATUSES = new Set(['', 'unknown', 'not attempted', 'not_attempted']);

function cleanStatus(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function finiteNumber(value) {
    if (value == null || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function clampPercent(value) {
    const number = finiteNumber(value);
    if (number == null) return null;
    return Math.max(0, Math.min(100, Math.round(number * 10) / 10));
}

function stateValues(state) {
    return state?.values && typeof state.values === 'object' && !Array.isArray(state.values)
        ? state.values
        : {};
}

// Kept for compatibility with existing unit tests and report helpers. Runtime
// snapshots are now normalized by ScormLearningStateService before reaching
// this service, so production reads no longer merge two independently queried
// stores.
function snapshotToLearningState(snapshot) {
    if (!snapshot) return null;
    let values = {};
    try {
        values = snapshot.rawMapJson ? JSON.parse(snapshot.rawMapJson) : {};
    } catch (_) {
        values = {};
    }
    if (!values || typeof values !== 'object' || Array.isArray(values)) values = {};
    return {
        values,
        lessonStatus: snapshot.lessonStatus || null,
        scoreRaw: snapshot.scoreRaw != null ? Number(snapshot.scoreRaw) : null,
        lessonLocation: snapshot.lessonLocation || null,
        suspendData: snapshot.suspendData || '',
        totalTime: snapshot.totalTime || null,
        progressPercent: null,
        sequence: Number(snapshot.stateVersion || 0),
        clientRevision: Number(snapshot.stateVersion || 0),
        updatedAt: snapshot.updatedAt || null
    };
}

function mergeCanonicalState(primary, fallback) {
    if (!primary) return fallback || null;
    if (!fallback) return primary;
    const primaryVersion = Number(primary.sequence || primary.stateVersion || 0);
    const fallbackVersion = Number(fallback.sequence || fallback.stateVersion || 0);
    const primaryTime = new Date(primary.updatedAt || 0).getTime();
    const fallbackTime = new Date(fallback.updatedAt || 0).getTime();
    const newer = fallbackVersion > primaryVersion || (fallbackVersion === primaryVersion && fallbackTime > primaryTime)
        ? fallback
        : primary;
    const older = newer === primary ? fallback : primary;
    return {
        ...older,
        ...newer,
        values: { ...(older.values || {}), ...(newer.values || {}) }
    };
}

function effectiveLessonStatus(state, fallbackStatus = null) {
    const values = stateValues(state);
    const successStatus = cleanStatus(values['cmi.success_status']);
    const scorm12Status = cleanStatus(values['cmi.core.lesson_status']);
    const completionStatus = cleanStatus(values['cmi.completion_status']);
    const derivedStatus = cleanStatus(state?.lessonStatus);
    const fallback = cleanStatus(fallbackStatus);

    if (FINISHED_STATUSES.has(successStatus)) return successStatus;
    if (FINISHED_STATUSES.has(scorm12Status)) return scorm12Status;
    if (FINISHED_STATUSES.has(completionStatus)) return completionStatus;
    if (FINISHED_STATUSES.has(derivedStatus)) return derivedStatus;
    if (FINISHED_STATUSES.has(fallback)) return fallback;

    if (!EMPTY_STATUSES.has(scorm12Status)) return scorm12Status;
    if (!EMPTY_STATUSES.has(completionStatus)) return completionStatus;
    if (!EMPTY_STATUSES.has(derivedStatus)) return derivedStatus;
    if (!EMPTY_STATUSES.has(fallback)) return fallback;
    return derivedStatus || fallback || 'not attempted';
}

function suspendProgress(state) {
    const values = stateValues(state);
    const raw = state?.suspendData || values['cmi.suspend_data'];
    if (!raw) return null;
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return clampPercent(parsed?.quizmotoProgress ?? parsed?.progressPercent ?? parsed?.progress);
    } catch (_) {
        return null;
    }
}

function packageRowFor(registration) {
    return registration?.package
        || registration?.course?.package
        || null;
}

function effectiveProgressPercent(state, fallbackProgress = null, lessonStatus = null, packageRow = null) {
    const status = cleanStatus(lessonStatus || effectiveLessonStatus(state));
    if (FINISHED_STATUSES.has(status)) return 100;

    const explicit = clampPercent(state?.progressPercent);
    if (explicit != null && explicit > 0) return explicit;

    const values = stateValues(state);
    const progressMeasure = finiteNumber(values['cmi.progress_measure']);
    if (progressMeasure != null && progressMeasure >= 0 && progressMeasure <= 1) {
        const measured = clampPercent(progressMeasure * 100);
        if (measured != null && measured > 0) return measured;
    }

    const custom = clampPercent(values['quizmoto.progress_percent'] ?? values['quizmoto.progress']);
    if (custom != null && custom > 0) return custom;

    const suspended = suspendProgress(state);
    if (suspended != null && suspended > 0) return suspended;

    const fromPlayer = clampPercent(deriveProgress({
        registration: { lastLessonStatus: status, status: null },
        cmiState: state,
        packageRow
    }));
    if (fromPlayer != null && fromPlayer > 0) return fromPlayer;

    if (explicit != null) return explicit;
    return clampPercent(fallbackProgress);
}

function hasCanonicalActivity(state, progressPercent = null, lessonStatus = null) {
    if (!state) return false;
    if (Number(state.sequence || 0) > 0 || Number(state.clientRevision || 0) > 0 || state.updatedAt) return true;
    if (progressPercent != null && progressPercent > 0) return true;
    const status = cleanStatus(lessonStatus || effectiveLessonStatus(state));
    return status && !EMPTY_STATUSES.has(status);
}

function resolvedScore(state, registration, packageRow) {
    if (state?.scoreRaw != null && Number(state.scoreRaw) !== 0) return Number(state.scoreRaw);
    const values = stateValues(state);
    const explicit = finiteNumber(values['cmi.core.score.raw'] ?? values['cmi.score.raw']);
    if (explicit != null && (values['cmi.core.score.raw'] != null || values['cmi.score.raw'] != null)) {
        return explicit;
    }
    const fromInteractions = liveInteractionScore(state, packageRow);
    if (fromInteractions != null) return fromInteractions;
    if (state?.scoreRaw != null) return Number(state.scoreRaw);
    if (registration?.lastScoreRaw != null) return Number(registration.lastScoreRaw);
    if (registration?.score != null) return Number(registration.score);
    return null;
}

function registrationProgress(registration, state = null) {
    const fallbackLesson = registration?.lastLessonStatus || registration?.lessonStatus || null;
    const lessonStatus = effectiveLessonStatus(state, fallbackLesson);
    const progressPercent = effectiveProgressPercent(
        state,
        registration?.progressPercent ?? null,
        lessonStatus,
        packageRowFor(registration)
    );
    const registrationStatus = cleanStatus(registration?.status);
    const completed = registrationStatus === 'completed' || FINISHED_STATUSES.has(cleanStatus(lessonStatus));
    const started = completed ||
        hasCanonicalActivity(state, progressPercent, lessonStatus) ||
        ['active', 'launched', 'started', 'in_progress'].includes(registrationStatus) ||
        Boolean(registration?.lastCommitAt || registration?.lastActivityAt);

    return {
        status: completed ? 'completed' : started ? 'in_progress' : 'not_started',
        lessonStatus,
        progressPercent: completed ? 100 : (progressPercent ?? 0),
        score: resolvedScore(state, registration, packageRowFor(registration)),
        totalTime: state?.totalTime || registration?.lastTotalTime || registration?.totalTime || null,
        lastActivityAt: state?.updatedAt || registration?.lastCommitAt || registration?.lastActivityAt || null
    };
}

async function loadCanonicalStates(registrations) {
    const ids = Array.from(new Set((registrations || [])
        .map((registration) => registration?.id || registration?.registrationId || registration?.instanceId)
        .filter(Boolean)
        .map(String)));
    if (!ids.length) return new Map();

    // One logical source of truth. ScormLearningStateService delegates to the
    // resilient runtime store, which itself handles Supabase table drift and
    // fallback. Do not silently swallow a total state-store failure here: the
    // route should return an error rather than displaying stale "not attempted"
    // data as if it were valid tracking.
    return LearningState.listByRegistrationIds(ids);
}

function enrichCourse(course, state) {
    const progress = registrationProgress(course, state);
    return {
        ...course,
        status: progress.status,
        lessonStatus: progress.lessonStatus,
        progressPercent: progress.progressPercent,
        progressAvailable: true,
        score: progress.score,
        totalTime: progress.totalTime,
        lastActivityAt: progress.lastActivityAt
    };
}

function summarizeProgressRows(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let completedCount = 0;
    let inProgressCount = 0;
    for (const row of list) {
        const status = String(row?.status || '').toLowerCase();
        if (status === 'completed') completedCount += 1;
        else if (status === 'in_progress') inProgressCount += 1;
    }
    return {
        assignmentCount: list.length,
        completedCount,
        inProgressCount,
        notStartedCount: Math.max(0, list.length - completedCount - inProgressCount),
        completionPercent: list.length ? Math.round((completedCount / list.length) * 100) : 0
    };
}

async function enrichDashboardCourses(dashboard) {
    const courses = Array.isArray(dashboard?.courses) ? dashboard.courses : [];
    if (!courses.length) return dashboard;
    const states = await loadCanonicalStates(courses);
    return {
        ...dashboard,
        courses: courses.map((course) => enrichCourse(
            course,
            states.get(String(course.registrationId || course.instanceId || '')) || null
        ))
    };
}

async function attachCanonicalState(registrations) {
    const list = Array.isArray(registrations) ? registrations : [];
    if (!list.length) return list;
    const states = await loadCanonicalStates(list);
    for (const reg of list) {
        const state = states.get(String(reg.id || reg.registrationId || '')) || null;
        if (typeof reg.setDataValue === 'function') reg.setDataValue('learningStateV2', state);
        else reg.learningStateV2 = state;
    }
    return list;
}

module.exports = {
    FINISHED_STATUSES,
    effectiveLessonStatus,
    effectiveProgressPercent,
    registrationProgress,
    loadCanonicalStates,
    mergeCanonicalState,
    snapshotToLearningState,
    attachCanonicalState,
    enrichCourse,
    enrichDashboardCourses,
    summarizeProgressRows
};
