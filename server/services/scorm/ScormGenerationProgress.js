const STORE = new Map();
const TTL_MS = 15 * 60 * 1000;

function cleanId(value) {
    const id = String(value || '').trim();
    return /^[A-Za-z0-9_-]{8,96}$/.test(id) ? id : '';
}

function clampPercent(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(1, Math.min(100, Math.round(numeric)));
}

function prune() {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, entry] of STORE.entries()) {
        if (!entry || Number(entry.updatedAt || 0) < cutoff) STORE.delete(id);
    }
}

function setProgress(progressId, userId, patch = {}) {
    const id = cleanId(progressId);
    if (!id) return null;
    prune();
    const existing = STORE.get(id) || {
        id,
        userId: String(userId || ''),
        task: '',
        percent: 1,
        stage: 'Starting',
        detail: '',
        status: 'running',
        modelStatus: '',
        predictionId: '',
        startedAt: Date.now(),
        updatedAt: Date.now()
    };
    if (existing.userId && String(userId || '') && existing.userId !== String(userId)) return null;
    const next = {
        ...existing,
        ...patch,
        id,
        userId: existing.userId || String(userId || ''),
        percent: clampPercent(patch.percent, existing.percent),
        updatedAt: Date.now()
    };
    STORE.set(id, next);
    return { ...next };
}

function getProgress(progressId, userId) {
    const id = cleanId(progressId);
    if (!id) return null;
    prune();
    const entry = STORE.get(id);
    if (!entry) return null;
    if (entry.userId && String(userId || '') && entry.userId !== String(userId)) return null;
    return { ...entry };
}

function failProgress(progressId, userId, error) {
    const message = String(error?.message || error || 'Course generation failed').slice(0, 500);
    return setProgress(progressId, userId, {
        status: 'error',
        stage: 'Generation failed',
        detail: message
    });
}

module.exports = {
    cleanId,
    setProgress,
    getProgress,
    failProgress
};
