const packageAnalysisCache = new WeakMap();

function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (_) {
        return fallback;
    }
}

function packageAnalysis(packageRow) {
    if (!packageRow || typeof packageRow !== 'object') return null;
    const raw = packageRow.analysisJson ?? packageRow.dataValues?.analysisJson ?? null;
    const cached = packageAnalysisCache.get(packageRow);
    if (cached && cached.raw === raw) return cached.parsed;
    const parsed = parseJson(raw, null);
    packageAnalysisCache.set(packageRow, { raw, parsed });
    return parsed;
}

function clampPercent(value) {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function isFinished(status) {
    return ['completed', 'passed', 'failed'].includes(String(status || '').toLowerCase());
}

function authoredPartCount(packageRow) {
    const analysis = packageAnalysis(packageRow);
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

function progressFromSuspendData(value) {
    const data = parseJson(value, null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return clampPercent(
        data.quizmotoProgress ??
        data.progressPercent ??
        data.progress ??
        data.completionPercent
    );
}

function stateValues(state) {
    if (!state) return {};
    if (state.values && typeof state.values === 'object') return state.values;
    return parseJson(state.rawMapJson, {});
}

function deriveProgress({ registration, cmiState, packageRow }) {
    const lessonStatus = cmiState?.lessonStatus || registration?.lastLessonStatus || null;
    const map = stateValues(cmiState);

    if (isFinished(lessonStatus) || registration?.status === 'completed') return 100;

    // Quizmoto-authored SCORM 1.2 modules persist their exact UI progress in
    // cmi.suspend_data. Prefer that signal before the legacy v2 progress column:
    // older saves could contain an accidental 0 there even while suspend_data
    // correctly recorded the learner at (for example) 50%.
    const suspendProgress = progressFromSuspendData(
        cmiState?.suspendData || map['cmi.suspend_data'] || null
    );
    if (suspendProgress != null) return suspendProgress;

    const explicit = clampPercent(cmiState?.progressPercent);
    if (explicit != null) return explicit;

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
    const map = stateValues(cmiState);
    const location = cmiState?.lessonLocation || map['cmi.location'] || map['cmi.core.lesson_location'] || null;
    if (!location) {
        if (isFinished(cmiState?.lessonStatus || registration?.lastLessonStatus)) return 'Completed';
        return registration?.status === 'active' || Number(cmiState?.sequence || 0) > 0
            ? 'Started — location unavailable'
            : 'Not started';
    }

    const raw = String(location).trim();
    if (/^\d+$/.test(raw)) {
        const index = Number(raw);
        const analysis = packageAnalysis(packageRow);
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

function field(row, key) {
    if (!row) return undefined;
    if (row[key] !== undefined) return row[key];
    return row.dataValues?.[key];
}

function stateForRegistration(registration, plain) {
    return plain.learningStateV2 || registration?.learningStateV2 || null;
}

function serializeRegistration(registration, course = null) {
    const plain = typeof registration?.toJSON === 'function' ? registration.toJSON() : { ...(registration || {}) };
    const cmiState = stateForRegistration(registration, plain);

    const packageRow = field(course, 'package') || registration?.course?.package || null;
    const courseTitle = field(course, 'title') || registration?.course?.title || null;
    const courseStatus = field(course, 'status') || registration?.course?.status || null;
    const inviteCode = field(course, 'inviteCode') || registration?.course?.inviteCode || null;

    const progressPercent = deriveProgress({ registration: plain, cmiState, packageRow });
    const lastLocation = locationLabel({ registration: plain, cmiState, packageRow });

    delete plain.learningStateV2;
    return {
        ...plain,
        progressPercent,
        progressAvailable: progressPercent != null,
        lastLocation,
        stateVersion: cmiState?.sequence ?? null,
        lastLocationRaw: cmiState?.lessonLocation || null,
        lastLessonStatus: cmiState?.lessonStatus || plain.lastLessonStatus || null,
        lastScoreRaw: cmiState?.scoreRaw != null ? cmiState.scoreRaw : plain.lastScoreRaw,
        lastTotalTime: cmiState?.totalTime || plain.lastTotalTime || null,
        courseTitle,
        courseStatus,
        inviteCode
    };
}

module.exports = {
    deriveProgress,
    locationLabel,
    serializeRegistration,
    progressFromLocation,
    progressFromSuspendData,
    authoredPartCount,
    packageAnalysis
};
