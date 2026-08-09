const { serializeRegistration } = require('./ScormProgressService');

function asPlain(value) {
    if (!value) return null;
    return typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function parseJson(value, fallback = null) {
    if (!value) return fallback;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (_) {
        return fallback;
    }
}

function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function interactionCount(value) {
    const parsed = parseJson(value, null);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length;
    return 0;
}

function qaState({ registration, cmiState, progressPercent }) {
    const lessonStatus = String(
        registration?.lastLessonStatus || cmiState?.lessonStatus || ''
    ).toLowerCase();

    if (['passed', 'failed', 'completed'].includes(lessonStatus)) return lessonStatus;
    if (registration?.status === 'completed' || Number(progressPercent) >= 100) return 'completed';
    if (cmiState?.initialized || registration?.lastCommitAt) return 'in progress';
    return 'ready';
}

function scorePercent(scoreRaw, scoreMin, scoreMax) {
    const raw = finiteNumber(scoreRaw);
    if (raw == null) return null;

    const min = finiteNumber(scoreMin);
    const max = finiteNumber(scoreMax);
    if (min != null && max != null && max > min) {
        return Math.max(0, Math.min(100, Math.round((((raw - min) / (max - min)) * 100) * 10) / 10));
    }

    if (raw >= 0 && raw <= 100) return Math.round(raw * 10) / 10;
    return null;
}

function serializePreviewStats(registration, course) {
    if (!registration) return null;

    const plainRegistration = asPlain(registration) || {};
    const cmiState = asPlain(plainRegistration.cmiState || registration.cmiState) || {};
    const row = serializeRegistration(registration, course);

    const scoreRaw = row.lastScoreRaw != null ? row.lastScoreRaw : cmiState.scoreRaw;
    const scoreMin = cmiState.scoreMin != null ? cmiState.scoreMin : null;
    const scoreMax = cmiState.scoreMax != null ? cmiState.scoreMax : null;
    const totalTime = row.lastTotalTime || cmiState.totalTime || null;
    const lessonStatus = row.lastLessonStatus || cmiState.lessonStatus || null;
    const progressPercent = row.progressPercent;

    return {
        registrationId: row.id,
        isPreview: true,
        qaState: qaState({ registration: row, cmiState, progressPercent }),
        progressPercent,
        progressAvailable: row.progressAvailable,
        scoreRaw: finiteNumber(scoreRaw),
        scoreMin: finiteNumber(scoreMin),
        scoreMax: finiteNumber(scoreMax),
        scorePercent: scorePercent(scoreRaw, scoreMin, scoreMax),
        lessonStatus,
        totalTime,
        sessionTime: cmiState.sessionTime || null,
        lastLocation: row.lastLocation,
        lastLocationRaw: row.lastLocationRaw,
        interactionCount: interactionCount(cmiState.interactionsJson),
        initialized: !!cmiState.initialized,
        stateVersion: cmiState.stateVersion ?? null,
        lastCommitAt: row.lastCommitAt || null,
        lastActivityAt: row.lastCommitAt || row.updatedAt || null,
        updatedAt: row.updatedAt || null
    };
}

module.exports = {
    serializePreviewStats,
    scorePercent,
    interactionCount
};
