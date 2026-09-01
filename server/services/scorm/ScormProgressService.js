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

function liveScoreProgress(cmiState, map) {
    const raw = Number(cmiState?.scoreRaw ?? map['cmi.core.score.raw'] ?? map['cmi.score.raw']);
    if (!Number.isFinite(raw)) return null;

    const min = Number(map['cmi.core.score.min'] ?? map['cmi.score.min']);
    const max = Number(map['cmi.core.score.max'] ?? map['cmi.score.max']);
    let percent = null;

    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        percent = ((raw - min) / (max - min)) * 100;
    } else if (raw >= 0 && raw <= 100) {
        percent = raw;
    }

    const normalized = clampPercent(percent);
    if (normalized == null) return null;
    return Math.min(99.9, normalized);
}

function liveInteractionScore(cmiState, packageRow = null) {
    const map = stateValues(cmiState);
    if (!map || typeof map !== 'object' || Array.isArray(map)) return null;

    const results = new Map();
    for (const [key, rawValue] of Object.entries(map)) {
        let match = String(key).match(/^cmi\.interactions\.(\d+)\.result$/i);
        if (!match) match = String(key).match(/^quizmoto\.quiz\.(\d+)\.result$/i);
        if (!match) continue;
        const value = String(rawValue || '').trim().toLowerCase();
        if (!value) continue;
        if (['correct', 'passed', 'true', 'right'].includes(value)) results.set(Number(match[1]), true);
        else if (['wrong', 'incorrect', 'failed', 'false'].includes(value)) results.set(Number(match[1]), false);
    }
    if (!results.size) return null;

    const analysis = packageAnalysis(packageRow);
    const quizCount = analysis && Array.isArray(analysis.quiz) ? analysis.quiz.length : 0;
    const highestInteraction = Math.max(...Array.from(results.keys())) + 1;
    const denominator = Math.max(1, quizCount || highestInteraction || results.size);
    const correct = Array.from(results.values()).filter(Boolean).length;
    return Math.max(0, Math.min(100, Math.round((correct / denominator) * 1000) / 10));
}

function explicitScoreRaw(cmiState, fallback = null) {
    const map = stateValues(cmiState);
    const fromMap = map['cmi.core.score.raw'] ?? map['cmi.score.raw'];
    if (fromMap != null && String(fromMap).trim() !== '') {
        const number = Number(fromMap);
        if (Number.isFinite(number)) return number;
    }
    if (cmiState?.scoreRaw != null && Number.isFinite(Number(cmiState.scoreRaw))) {
        return Number(cmiState.scoreRaw);
    }
    if (fallback != null && String(fallback).trim() !== '') {
        const number = Number(fallback);
        if (Number.isFinite(number)) return number;
    }
    return null;
}

function resolvedScoreRaw(cmiState, fallback = null, packageRow = null) {
    const explicit = explicitScoreRaw(cmiState, fallback);
    const map = stateValues(cmiState);
    const hasExplicitKey = (map['cmi.core.score.raw'] != null && String(map['cmi.core.score.raw']).trim() !== '')
        || (map['cmi.score.raw'] != null && String(map['cmi.score.raw']).trim() !== '');
    if (hasExplicitKey && explicit != null) return explicit;

    const fromInteractions = liveInteractionScore(cmiState, packageRow);
    if (fromInteractions != null) return fromInteractions;
    return explicit;
}

function deriveProgress({ registration, cmiState, packageRow }) {
    const lessonStatus = cmiState?.lessonStatus || registration?.lastLessonStatus || null;
    const map = stateValues(cmiState);

    if (isFinished(lessonStatus) || registration?.status === 'completed') return 100;

    let zeroSignal = null;

    const suspendProgress = progressFromSuspendData(
        cmiState?.suspendData || map['cmi.suspend_data'] || null
    );
    if (suspendProgress != null) {
        if (suspendProgress > 0) return suspendProgress;
        zeroSignal = 0;
    }

    const explicit = clampPercent(cmiState?.progressPercent);
    if (explicit != null) {
        if (explicit > 0) return explicit;
        zeroSignal = 0;
    }

    const progressMeasure = Number(map['cmi.progress_measure']);
    if (Number.isFinite(progressMeasure) && progressMeasure >= 0 && progressMeasure <= 1) {
        const measured = clampPercent(progressMeasure * 100);
        if (measured > 0) return measured;
        zeroSignal = 0;
    }

    const location = cmiState?.lessonLocation || map['cmi.location'] || map['cmi.core.lesson_location'] || null;
    const fromLocation = progressFromLocation(location, packageRow);
    if (fromLocation != null) {
        if (fromLocation > 0) return fromLocation;
        zeroSignal = 0;
    }

    const fromScore = liveScoreProgress(cmiState, map);
    if (fromScore != null && fromScore > 0) return fromScore;

    const fromInteractions = liveInteractionScore(cmiState, packageRow);
    if (fromInteractions != null && fromInteractions > 0) return Math.min(99.9, fromInteractions);

    if (zeroSignal != null) return zeroSignal;
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
    const lastScoreRaw = resolvedScoreRaw(cmiState, plain.lastScoreRaw, packageRow);

    delete plain.learningStateV2;
    return {
        ...plain,
        progressPercent,
        progressAvailable: progressPercent != null,
        lastLocation,
        stateVersion: cmiState?.sequence ?? null,
        lastLocationRaw: cmiState?.lessonLocation || null,
        lastLessonStatus: cmiState?.lessonStatus || plain.lastLessonStatus || null,
        lastScoreRaw,
        score: lastScoreRaw,
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
    liveScoreProgress,
    liveInteractionScore,
    resolvedScoreRaw,
    authoredPartCount,
    packageAnalysis
};
