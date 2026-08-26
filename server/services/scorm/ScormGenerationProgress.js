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

function ownedEntry(progressId, userId) {
    const id = cleanId(progressId);
    if (!id) return null;
    prune();
    const entry = STORE.get(id);
    if (!entry) return null;
    if (entry.userId && String(userId || '') && entry.userId !== String(userId)) return null;
    return entry;
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
        updatedAt: Date.now(),
        cancelledAt: 0
    };
    if (existing.userId && String(userId || '') && existing.userId !== String(userId)) return null;

    // Cancellation is terminal. Late progress callbacks from provider requests
    // must never turn a stopped job back into a running/complete job.
    if (existing.status === 'cancelled' && patch.status !== 'cancelled') return { ...existing };

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
    const entry = ownedEntry(progressId, userId);
    return entry ? { ...entry } : null;
}

function cancelProgress(progressId, userId) {
    const existing = ownedEntry(progressId, userId);
    if (!existing) return null;
    if (existing.status === 'complete' || existing.status === 'error') return { ...existing };
    const now = Date.now();
    const next = {
        ...existing,
        status: 'cancelled',
        stage: 'Generation stopped',
        detail: 'Course generation was stopped by the user.',
        modelStatus: 'cancelled',
        cancelledAt: now,
        updatedAt: now
    };
    STORE.set(existing.id, next);
    return { ...next };
}

function isCancelled(progressId, userId) {
    return Boolean(ownedEntry(progressId, userId)?.status === 'cancelled');
}

function cancellationError() {
    const error = new Error('Course generation was stopped.');
    error.code = 'SCORM_GENERATION_CANCELLED';
    return error;
}

function assertNotCancelled(progressId, userId) {
    if (progressId && isCancelled(progressId, userId)) throw cancellationError();
}

function failProgress(progressId, userId, error) {
    const current = ownedEntry(progressId, userId);
    if (current?.status === 'cancelled' || error?.code === 'SCORM_GENERATION_CANCELLED') {
        return current ? { ...current } : null;
    }
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
    cancelProgress,
    isCancelled,
    assertNotCancelled,
    cancellationError,
    failProgress
};
