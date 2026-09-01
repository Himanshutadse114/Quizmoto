const LearningState = require('./ScormLearningStateService');

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

function effectiveLessonStatus(state, fallbackStatus = null) {
    const values = stateValues(state);
    const successStatus = cleanStatus(values['cmi.success_status']);
    const scorm12Status = cleanStatus(values['cmi.core.lesson_status']);
    const completionStatus = cleanStatus(values['cmi.completion_status']);
    const derivedStatus = cleanStatus(state?.lessonStatus);
    const fallback = cleanStatus(fallbackStatus);

    // Completion must win over the player's cross-standard placeholder defaults.
    // The player exposes both SCORM 1.2 and 2004 APIs, so a valid 2004
    // cmi.completion_status can otherwise be masked by the untouched
    // cmi.core.lesson_status="not attempted" default (and vice versa).
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

function effectiveProgressPercent(state, fallbackProgress = null, lessonStatus = null) {
    const status = cleanStatus(lessonStatus || effectiveLessonStatus(state));
    if (FINISHED_STATUSES.has(status)) return 100;

    const explicit = clampPercent(state?.progressPercent);
    if (explicit != null) return explicit;

    const values = stateValues(state);
    const progressMeasure = finiteNumber(values['cmi.progress_measure']);
    if (progressMeasure != null && progressMeasure >= 0 && progressMeasure <= 1) {
        return clampPercent(progressMeasure * 100);
    }

    const custom = clampPercent(values['quizmoto.progress_percent'] ?? values['quizmoto.progress']);
    if (custom != null) return custom;

    const suspended = suspendProgress(state);
    if (suspended != null) return suspended;

    return clampPercent(fallbackProgress);
}

function hasCanonicalActivity(state, progressPercent = null, lessonStatus = null) {
    if (!state) return false;
    if (Number(state.sequence || 0) > 0 || Number(state.clientRevision || 0) > 0 || state.updatedAt) return true;
    if (progressPercent != null && progressPercent > 0) return true;
    const status = cleanStatus(lessonStatus || effectiveLessonStatus(state));
    return status && !EMPTY_STATUSES.has(status);
}

function registrationProgress(registration, state = null) {
    const fallbackLesson = registration?.lastLessonStatus || registration?.lessonStatus || null;
    const lessonStatus = effectiveLessonStatus(state, fallbackLesson);
    const progressPercent = effectiveProgressPercent(
        state,
        registration?.progressPercent ?? null,
        lessonStatus
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
        score: state?.scoreRaw != null
            ? Number(state.scoreRaw)
            : (registration?.lastScoreRaw != null
                ? Number(registration.lastScoreRaw)
                : (registration?.score != null ? Number(registration.score) : null)),
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
    return LearningState.listByRegistrationIds(ids);
}

function enrichCourse(course, state) {
    const progress = registrationProgress(course, state);
    return {
        ...course,
        status: progress.status,
        lessonStatus: progress.lessonStatus,
        progressPercent: progress.progressPercent,
        score: progress.score,
        totalTime: progress.totalTime,
        lastActivityAt: progress.lastActivityAt
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

module.exports = {
    FINISHED_STATUSES,
    effectiveLessonStatus,
    effectiveProgressPercent,
    registrationProgress,
    loadCanonicalStates,
    enrichCourse,
    enrichDashboardCourses
};
