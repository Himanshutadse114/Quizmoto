const { serializeRegistration, locationLabel } = require('./ScormProgressService');
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
    if (value == null || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function stateMap(state) {
    if (!state) return {};
    if (state.values && typeof state.values === 'object') return state.values;
    return parseJson(state.rawMapJson, {}) || {};
}

function stateValue(state, keys) {
    const map = stateMap(state);
    for (const key of keys) {
        const value = map[key];
        if (value != null && String(value).trim() !== '') return value;
    }
    return null;
}

function interactionCount(interactionsJson, rawMapJson = null, values = null) {
    const parsedInteractions = parseJson(interactionsJson, null);
    if (Array.isArray(parsedInteractions)) return parsedInteractions.length;
    if (parsedInteractions && typeof parsedInteractions === 'object') {
        return Object.keys(parsedInteractions).length;
    }

    const map = values && typeof values === 'object' && !Array.isArray(values)
        ? values
        : parseJson(rawMapJson, null);
    if (!map || typeof map !== 'object' || Array.isArray(map)) return 0;

    const indices = new Set();
    for (const key of Object.keys(map)) {
        const match = String(key).match(/^cmi\.interactions\.(\d+)\./i);
        if (match) indices.add(match[1]);
    }
    return indices.size;
}

function liveInteractionScore(state, course) {
    const map = stateMap(state);
    if (!map || typeof map !== 'object' || Array.isArray(map)) return null;

    const results = new Map();
    for (const [key, rawValue] of Object.entries(map)) {
        const match = String(key).match(/^cmi\.interactions\.(\d+)\.result$/i);
        if (!match) continue;
        const value = String(rawValue || '').trim().toLowerCase();
        if (!value) continue;
        if (value === 'correct' || value === 'wrong' || value === 'incorrect') {
            results.set(Number(match[1]), value === 'correct');
        }
    }
    if (!results.size) return null;

    const analysis = parseJson(course?.package?.analysisJson, {}) || {};
    const quizCount = Array.isArray(analysis.quiz) ? analysis.quiz.length : 0;
    const highestInteraction = Math.max(...Array.from(results.keys())) + 1;
    const denominator = Math.max(1, quizCount || highestInteraction || results.size);
    const correct = Array.from(results.values()).filter(Boolean).length;

    return Math.max(0, Math.min(100, Math.round((correct / denominator) * 1000) / 10));
}

function qaState({ registration, cmiState, progressPercent }) {
    const lessonStatus = String(
        cmiState?.lessonStatus || registration?.lastLessonStatus || ''
    ).toLowerCase();

    if (['passed', 'failed', 'completed'].includes(lessonStatus)) return lessonStatus;
    if (registration?.status === 'completed' || Number(progressPercent) >= 100) return 'completed';
    if (Number(cmiState?.sequence || 0) > 0 || cmiState?.initialized || registration?.lastCommitAt) return 'in progress';
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
    const legacyState = runtimeStateFor(registration, plainRegistration);
    const learningStateV2 = asPlain(plainRegistration.learningStateV2 || registration.learningStateV2) || null;
    const primaryState = learningStateV2 || legacyState;
    const row = serializeRegistration(registration, course);

    // Authored courses write each quiz interaction immediately, while the final
    // cmi.core.score.raw is traditionally written only when the learner finishes.
    // The v2 state layer can also contain a legacy row-level 0 before a score key
    // has ever been written. For Admin Preview, derive a live provisional score
    // from the captured interaction results until an explicit SCORM score exists.
    const explicitScoreRaw = stateValue(primaryState, ['cmi.core.score.raw', 'cmi.score.raw']);
    const provisionalInteractionScore = explicitScoreRaw == null
        ? liveInteractionScore(primaryState, course)
        : null;
    const scoreRaw = explicitScoreRaw != null
        ? explicitScoreRaw
        : provisionalInteractionScore != null
            ? provisionalInteractionScore
            : primaryState?.scoreRaw != null ? primaryState.scoreRaw : row.lastScoreRaw;

    const scoreMin = stateValue(primaryState, ['cmi.core.score.min', 'cmi.score.min']) ?? legacyState?.scoreMin ?? null;
    const scoreMax = stateValue(primaryState, ['cmi.core.score.max', 'cmi.score.max']) ?? legacyState?.scoreMax ?? null;
    const totalTime = primaryState?.totalTime || row.lastTotalTime || legacyState?.totalTime || null;
    const progressPercent = row.progressPercent;
    let lessonStatus = primaryState?.lessonStatus || row.lastLessonStatus || legacyState?.lessonStatus || null;

    // Some SCORM packages keep lesson_status at "not attempted" while actively
    // updating score/interactions. Once we have live progress, present the actual
    // running state to the admin instead of the stale authored status string.
    const statusKey = String(lessonStatus || '').toLowerCase();
    if (Number(progressPercent) > 0 && Number(progressPercent) < 100 &&
        (!statusKey || statusKey === 'not attempted' || statusKey === 'unknown')) {
        lessonStatus = 'incomplete';
    }

    // Prefer the v2 learner-state location. Legacy preview state is retained only
    // as a compatibility fallback for older QA registrations.
    const lastLocationRaw = primaryState?.lessonLocation || row.lastLocationRaw || legacyState?.lessonLocation || null;
    const lastLocation = lastLocationRaw
        ? locationLabel({ registration: row, cmiState: primaryState, packageRow: course?.package || null })
        : row.lastLocation;

    return {
        registrationId: row.id,
        isPreview: true,
        qaState: qaState({ registration: row, cmiState: primaryState, progressPercent }),
        progressPercent,
        progressAvailable: row.progressAvailable,
        scoreRaw: finiteNumber(scoreRaw),
        scoreMin: finiteNumber(scoreMin),
        scoreMax: finiteNumber(scoreMax),
        scorePercent: scorePercent(scoreRaw, scoreMin, scoreMax),
        lessonStatus,
        totalTime,
        sessionTime: stateValue(primaryState, ['cmi.core.session_time', 'cmi.session_time']) || legacyState?.sessionTime || null,
        lastLocation,
        lastLocationRaw,
        interactionCount: interactionCount(
            legacyState?.interactionsJson,
            legacyState?.rawMapJson,
            learningStateV2?.values || null
        ),
        initialized: Number(learningStateV2?.sequence || 0) > 0 || !!legacyState?.initialized,
        stateVersion: learningStateV2?.sequence ?? legacyState?.stateVersion ?? null,
        lastCommitAt: row.lastCommitAt || learningStateV2?.updatedAt || plainRegistration.runtimeSnapshot?.updatedAt || null,
        lastActivityAt: row.lastCommitAt || learningStateV2?.updatedAt || plainRegistration.runtimeSnapshot?.updatedAt || row.updatedAt || null,
        updatedAt: row.updatedAt || null
    };
}

module.exports = {
    serializePreviewStats,
    scorePercent,
    interactionCount,
    liveInteractionScore
};