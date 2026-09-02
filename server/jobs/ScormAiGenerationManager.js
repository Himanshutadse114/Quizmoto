const path = require('path');
const { fork } = require('child_process');
const {
    cleanId,
    setProgress,
    cancelProgress,
    failProgress
} = require('../services/scorm/ScormGenerationProgress');
const { getObjectStorage } = require('../storage/ObjectStorage');
const logger = require('../utils/logger');

const queue = [];
const active = new Map();
const queued = new Map();

function concurrency() {
    const configured = Number(process.env.SCORM_GENERATION_CONCURRENCY || 1);
    return Math.max(1, Math.min(3, Number.isFinite(configured) ? Math.floor(configured) : 1));
}

function childPath() {
    return path.join(__dirname, 'scormAiGenerationChild.js');
}

function generationError(value = {}) {
    const error = new Error(String(value.message || 'Course generation failed.'));
    error.code = value.code || 'SCORM_AI_ERROR';
    return error;
}

function cleanupSource(payload) {
    const key = String(payload?.sourceKey || '').trim();
    if (!key || !key.startsWith('ai-author/source/')) return;
    Promise.resolve()
        .then(() => getObjectStorage().deleteObject(key))
        .catch((error) => logger.warn('scorm_ai_source_cleanup_failed', { module: 'scorm', key, error: error.message }));
}

function finishActive(progressId) {
    const entry = active.get(progressId);
    if (entry?.child?.connected) {
        try { entry.child.disconnect(); } catch (_) {}
    }
    active.delete(progressId);
    setImmediate(pump);
}

function startJob(job) {
    queued.delete(job.progressId);

    const child = fork(childPath(), [], {
        env: process.env,
        stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });

    const entry = { ...job, child, settled: false };
    active.set(job.progressId, entry);

    setProgress(job.progressId, job.userId, {
        task: 'generate',
        status: 'running',
        percent: 2,
        stage: 'Preparing final course',
        detail: 'Course generation is running in an isolated worker so the platform stays responsive.'
    });

    const settle = (kind, payload) => {
        if (entry.settled) return;
        entry.settled = true;

        if (kind === 'complete') {
            setProgress(job.progressId, job.userId, {
                task: 'generate',
                status: 'complete',
                percent: 100,
                stage: 'Course ready',
                detail: 'The generated SCORM course is ready to open.',
                modelStatus: 'succeeded',
                result: payload || null
            });
            logger.info('scorm_ai_worker_complete', {
                module: 'scorm',
                progressId: job.progressId,
                packageId: payload?.packageId || null,
                courseId: payload?.courseId || null
            });
        } else if (kind === 'cancelled') {
            cancelProgress(job.progressId, job.userId);
            logger.info('scorm_ai_worker_cancelled', { module: 'scorm', progressId: job.progressId });
        } else {
            const error = generationError(payload || {});
            failProgress(job.progressId, job.userId, error);
            logger.error('scorm_ai_worker_failed', {
                module: 'scorm',
                progressId: job.progressId,
                error: error.message,
                code: error.code
            });
        }

        cleanupSource(job.payload);
        finishActive(job.progressId);
    };

    child.on('message', (message) => {
        if (!message || message.progressId !== job.progressId) return;
        if (message.type === 'progress') {
            setProgress(job.progressId, job.userId, {
                task: 'generate',
                status: 'running',
                ...(message.patch || {})
            });
            return;
        }
        if (message.type === 'complete') {
            settle('complete', message.result || null);
            return;
        }
        if (message.type === 'error') {
            if (message.error?.code === 'SCORM_GENERATION_CANCELLED') settle('cancelled');
            else settle('error', message.error || {});
        }
    });

    child.on('error', (error) => settle('error', { message: error.message, code: 'SCORM_WORKER_START_FAILED' }));
    child.on('exit', (code, signal) => {
        if (entry.settled) return;
        if (entry.cancelRequested) {
            settle('cancelled');
            return;
        }
        settle('error', {
            message: `Course generation worker stopped unexpectedly${signal ? ` (${signal})` : code != null ? ` (code ${code})` : ''}.`,
            code: 'SCORM_WORKER_EXITED'
        });
    });

    child.send({
        type: 'run',
        progressId: job.progressId,
        userId: job.userId,
        payload: job.payload || {}
    });
}

function pump() {
    while (active.size < concurrency() && queue.length) {
        const next = queue.shift();
        if (!next || !queued.has(next.progressId)) continue;
        startJob(next);
    }
}

function enqueue({ progressId, userId, payload }) {
    const id = cleanId(progressId);
    if (!id) {
        const error = new Error('A valid progressId is required for background generation.');
        error.code = 'SCORM_PROGRESS_ID_REQUIRED';
        throw error;
    }
    if (active.has(id) || queued.has(id)) return { accepted: true, progressId: id, duplicate: true };

    const job = { progressId: id, userId: String(userId || ''), payload: payload || {} };
    queued.set(id, job);
    queue.push(job);
    setProgress(id, userId, {
        task: 'generate',
        status: 'running',
        percent: 1,
        stage: active.size >= concurrency() ? 'Queued for generation' : 'Starting generation',
        detail: active.size >= concurrency()
            ? 'Your course is queued. You can continue using the platform while it waits for an available generation worker.'
            : 'Starting an isolated course generation worker.'
    });
    setImmediate(pump);
    return { accepted: true, progressId: id, duplicate: false };
}

function cancel(progressId, userId) {
    const id = cleanId(progressId);
    if (!id) return null;

    if (queued.has(id)) {
        const job = queued.get(id);
        queued.delete(id);
        const index = queue.findIndex((candidate) => candidate.progressId === id);
        if (index >= 0) queue.splice(index, 1);
        cleanupSource(job?.payload);
        return cancelProgress(id, userId);
    }

    const entry = active.get(id);
    if (entry) {
        entry.cancelRequested = true;
        try { entry.child.send({ type: 'cancel', progressId: id }); } catch (_) {}
        const cancelled = cancelProgress(id, userId);
        const timer = setTimeout(() => {
            const current = active.get(id);
            if (current && !current.settled) {
                try { current.child.kill('SIGTERM'); } catch (_) {}
            }
        }, 1500);
        timer.unref?.();
        return cancelled;
    }

    return cancelProgress(id, userId);
}

function stats() {
    return {
        queued: queued.size,
        active: active.size,
        concurrency: concurrency()
    };
}

module.exports = { enqueue, cancel, stats };
