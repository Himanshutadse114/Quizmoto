function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (_) {
        return fallback;
    }
}

function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function isFinished(status) {
    return ['completed', 'passed', 'failed'].includes(String(status || '').toLowerCase());
}

function authoredPartCount(packageRow) {
    const analysis = parseJson(packageRow?.analysisJson, null);
    if (!analysis || !Array.isArray(analysis.slides)) return null;
    const quizCount = Array.isArray(analysis.quiz) ? analysis.quiz.length : 0;
    return 1 + analysis.slides.length + quizCount + 1;
}

function progressFromLocation(location, packageRow) {
    if (location == null || location === '') return null;
    const raw = String(location).trim();
    if (/^\d+$/.test(raw)) {
        const current = Number(raw);
        const total = authoredPartCount(packageRow);
        if (total && total > 1) return clampPercent((current / (total - 1)) * 100);
    }
    const match = raw.match(/(?:^|\|)progress:(\d+(?:\.\d+)?)/i);
    if (match) return clampPercent(match[1]);
    return null;
}

function deriveProgress({ registration, cmiState, packageRow }) {
    const lessonStatus = cmiState?.lessonStatus || registration?.lastLessonStatus || null;
    const map = parseJson(cmiState?.rawMapJson, {});

    if (isFinished(lessonStatus) || registration?.status === 'completed') return 100;

    const progressMeasure = Number(map['cmi.progress_measure']);
    if (Number.isFinite(progressMeasure) && progressMeasure >= 0 && progressMeasure <= 1) {
        return clampPercent(progressMeasure * 100);
    }

    const location = cmiState?.lessonLocation || map['cmi.location'] || map['cmi.core.lesson_location'] || null;
    const fromLocation = progressFromLocation(location, packageRow);
    if (fromLocation != null) return fromLocation;

    if (!lessonStatus || String(lessonStatus).toLowerCase() === 'not attempted') return 0;
    return null;
}

function locationLabel({ registration, cmiState, packageRow }) {
    const location = cmiState?.lessonLocation || null;
    if (!location) {
        if (isFinished(cmiState?.lessonStatus || registration?.lastLessonStatus)) return 'Completed';
        return registration?.status === 'active' ? 'Started — location unavailable' : 'Not started';
    }

    const raw = String(location).trim();
    if (/^\d+$/.test(raw)) {
        const index = Number(raw);
        const analysis = parseJson(packageRow?.analysisJson, null);
        if (analysis && Array.isArray(analysis.slides)) {
            if (index === 0) return 'Introduction';
            const slideIndex = index - 1;
            if (slideIndex >= 0 && slideIndex < analysis.slides.length) {
                return analysis.slides[slideIndex]?.title || `Learning section ${slideIndex + 1}`;
            }
            const quizStart = 1 + analysis.slides.length;
            const quizCount = Array.isArray(analysis.quiz) ? analysis.quiz.length : 0;
            if (index >= quizStart && index < quizStart + quizCount) {
                return `Knowledge check ${index - quizStart + 1}`;
            }
            if (index >= quizStart + quizCount) return 'Completion screen';
        }
        return `Part ${index + 1}`;
    }
    return raw.slice(0, 160);
}

function serializeRegistration(registration, course = null) {
    const plain = typeof registration?.toJSON === 'function' ? registration.toJSON() : { ...(registration || {}) };
    const cmiState = plain.cmiState || registration?.cmiState || null;
    const coursePlain = course && typeof course.toJSON === 'function' ? course.toJSON() : course;
    const packageRow = coursePlain?.package || registration?.course?.package || null;
    const progressPercent = deriveProgress({ registration: plain, cmiState, packageRow });
    const lastLocation = locationLabel({ registration: plain, cmiState, packageRow });

    delete plain.cmiState;
    return {
        ...plain,
        progressPercent,
        progressAvailable: progressPercent != null,
        lastLocation,
        stateVersion: cmiState?.stateVersion ?? null,
        lastLocationRaw: cmiState?.lessonLocation || null,
        courseTitle: coursePlain?.title || registration?.course?.title || null,
        courseStatus: coursePlain?.status || registration?.course?.status || null,
        inviteCode: coursePlain?.inviteCode || registration?.course?.inviteCode || null
    };
}

module.exports = {
    deriveProgress,
    locationLabel,
    serializeRegistration,
    progressFromLocation,
    authoredPartCount
};