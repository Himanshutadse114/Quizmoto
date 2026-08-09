const { serializeRegistration } = require('./ScormProgressService');
const RuntimeStore = require('./ScormRuntimeSnapshotStore');

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

function interactionCount(interactionsJson, rawMapJson = null) {
    const parsedInteractions = parseJson(interactionsJson, null);
    if (Array.isArray(parsedInteractions)) return parsedInteractions.length;
    if (parsedInteractions && typeof parsedInteractions === 'object') {
        return Object.keys(parsedInteractions).length;
    }

    const map = parseJson(rawMapJson, null);
    if (!map || typeof map !== 'object' || Array.isArray(map)) return 0;

    const indices = new Set();
    for (const key of Object.keys(map)) {
        const match = String(key).match(/^cmi\.interactions\.(\d+)\./i);
        if (match) indices.add(match[1]);
    }
    return indices.size;
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

function runtimeStateFor(registration, plainRegistration) {
    const snapshot = plainRegistration.runtimeSnapshot || registration.runtimeSnapshot;
    const canonical = RuntimeStore.snapshotState(snapshot);
    if (canonical) return canonical;
    return asPlain(plainRegistration.cmiState || registration.cmiState) || {};
}

function serializePreviewStats(registration, course) {
    if (!registration) return null;

    const plainRegistration = asPlain(registration) || {};
    const cmiState = runtimeStateFor(registration, plainRegistration);
    const row = serializeRegistration(registration, course);

    const scoreRaw = cmiState.scoreRaw != null ? cmiState.scoreRaw : row.lastScoreRaw;
    const scoreMin = cmiState.scoreMin != null ? cmiState.scoreMin : null;
    const scoreMax = cmiState.scoreMax != null ? cmiState.scoreMax : null;
    const totalTime = cmiState.totalTime || row.lastTotalTime || null;
    const lessonStatus = cmiState.lessonStatus || row.lastLessonStatus || null;
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
        interactionCount: interactionCount(cmiState.interactionsJson, cmiState.rawMapJson),
        initialized: !!cmiState.initialized,
        stateVersion: cmiState.stateVersion ?? null,
        lastCommitAt: row.lastCommitAt || plainRegistration.runtimeSnapshot?.updatedAt || null,
        lastActivityAt: row.lastCommitAt || plainRegistration.runtimeSnapshot?.updatedAt || row.updatedAt || null,
        updatedAt: row.updatedAt || null
    };
}

module.exports = {
    serializePreviewStats,
    scorePercent,
    interactionCount
};
