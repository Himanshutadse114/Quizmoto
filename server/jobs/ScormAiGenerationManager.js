const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { fork } = require('child_process');
const { Op } = require('sequelize');
const {
    cleanId,
    setProgress,
    getProgress: getMemoryProgress,
    cancelProgress,
    failProgress
} = require('../services/scorm/ScormGenerationProgress');
const ScormGenerationJob = require('../models/scorm/ScormGenerationJob');
const { getObjectStorage } = require('../storage/ObjectStorage');
const logger = require('../utils/logger');

const queue = [];
const active = new Map();
const queued = new Map();
const INSTANCE_ID = `${os.hostname()}-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const LEASE_MS = Math.max(20000, Number(process.env.SCORM_GENERATION_LEASE_MS || 45000));
const RECOVERY_INTERVAL_MS = Math.max(5000, Number(process.env.SCORM_GENERATION_RECOVERY_MS || 10000));
const TERMINAL_KEEP_MS = 24 * 60 * 60 * 1000;
let recoveryTimer = null;
let recoveryRunning = false;
let shuttingDown = false;

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

function clampPercent(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return Math.max(1, Number(fallback) || 1);
    return Math.max(1, Math.min(100, Math.round(numeric)));
}

function leaseUntil() {
    return new Date(Date.now() + LEASE_MS);
}

function safeJson(value, fallback = null) {
    try {
        return JSON.stringify(value == null ? fallback : value);
    } catch (_) {
        return JSON.stringify(fallback);
    }
}

function parseJson(value, fallback = null) {
    if (!value) return fallback;
    try {
        return JSON.parse(String(value));
    } catch (_) {
        return fallback;
    }
}

function cleanupSource(payload) {
    const key = String(payload?.sourceKey || '').trim();
    if (!key || !key.startsWith('ai-author/source/')) return;
    Promise.resolve()
        .then(() => getObjectStorage().deleteObject(key))
        .catch((error) => logger.warn('scorm_ai_source_cleanup_failed', { module: 'scorm', key, error: error.message }));
}

function rowProgress(row) {
    if (!row) return null;
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    return {
        id: plain.progressId,
        userId: String(plain.userId || ''),
        task: 'generate',
        percent: clampPercent(plain.percent, 1),
        stage: plain.stage || (plain.status === 'complete' ? 'Course ready' : 'Course generation'),
        detail: plain.detail || plain.errorMessage || '',
        status: plain.status === 'failed' ? 'error' : plain.status,
        modelStatus: plain.modelStatus || '',
        startedAt: plain.startedAt ? new Date(plain.startedAt).getTime() : Date.now(),
        updatedAt: plain.updatedAt ? new Date(plain.updatedAt).getTime() : Date.now(),
        cancelledAt: plain.cancelledAt ? new Date(plain.cancelledAt).getTime() : 0,
        result: parseJson(plain.resultJson, null)
    };
}

async function createDurableJob(job, stage, detail) {
    const now = new Date();
    const values = {
        progressId: job.progressId,
        userId: String(job.userId || ''),
        payloadJson: safeJson(job.payload || {}, {}),
        status: 'queued',
        percent: 1,
        stage,
        detail,
        modelStatus: 'queued',
        resultJson: null,
        errorMessage: null,
        attempts: 0,
        leaseOwner: INSTANCE_ID,
        leaseExpiresAt: leaseUntil(),
        startedAt: now,
        cancelledAt: null
    };
    await ScormGenerationJob.upsert(values);
}

async function updateDurableJob(progressId, patch = {}, requireLease = true) {
    const values = { ...patch };
    if (values.result !== undefined) {
        values.resultJson = safeJson(values.result, null);
        delete values.result;
    }
    if (values.percent !== undefined) values.percent = clampPercent(values.percent, 1);
    if (requireLease && !['complete', 'error', 'failed', 'cancelled'].includes(String(values.status || ''))) {
        values.leaseExpiresAt = leaseUntil();
    }
    const where = { progressId };
    if (requireLease) where.leaseOwner = INSTANCE_ID;
    try {
        await ScormGenerationJob.update(values, { where });
    } catch (error) {
        logger.warn('scorm_ai_durable_progress_failed', {
            module: 'scorm',
            progressId,
            error: error.message
        });
    }
}

async function heartbeatLeases() {
    const ids = [...new Set([...active.keys(), ...queued.keys()])];
    if (!ids.length) return;
    try {
        await ScormGenerationJob.update({ leaseExpiresAt: leaseUntil() }, {
            where: {
                progressId: { [Op.in]: ids },
                leaseOwner: INSTANCE_ID,
                status: { [Op.in]: ['queued', 'running'] }
            }
        });
    } catch (error) {
        logger.warn('scorm_ai_lease_heartbeat_failed', { module: 'scorm', error: error.message });
    }
}

function expiredLeaseWhere(now = new Date()) {
    return {
        status: { [Op.in]: ['queued', 'running'] },
        [Op.or]: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { [Op.lt]: now } }
        ]
    };
}

async function recoverPersistedJobs() {
    if (recoveryRunning || shuttingDown) return;
    recoveryRunning = true;
    try {
        const now = new Date();
        const candidates = await ScormGenerationJob.findAll({
            where: expiredLeaseWhere(now),
            order: [['updatedAt', 'ASC']],
            limit: 20
        });

        for (const row of candidates) {
            if (shuttingDown) break;
            const id = cleanId(row.progressId);
            if (!id || active.has(id) || queued.has(id)) continue;

            const claimWhere = {
                progressId: id,
                ...expiredLeaseWhere(now)
            };
            const [claimed] = await ScormGenerationJob.update({
                status: 'queued',
                stage: 'Resuming course generation',
                detail: 'The platform restarted while this course was being created. Generation is resuming automatically.',
                modelStatus: 'queued',
                leaseOwner: INSTANCE_ID,
                leaseExpiresAt: leaseUntil(),
                attempts: Number(row.attempts || 0) + 1
            }, { where: claimWhere });
            if (!claimed) continue;

            const payload = parseJson(row.payloadJson, null);
            if (!payload || typeof payload !== 'object') {
                await updateDurableJob(id, {
                    status: 'error',
                    modelStatus: 'failed',
                    stage: 'Generation failed',
                    detail: 'The saved course generation request could not be restored.',
                    errorMessage: 'Saved generation payload is invalid.',
                    leaseOwner: null,
                    leaseExpiresAt: null
                }, false);
                continue;
            }

            const job = {
                progressId: id,
                userId: String(row.userId || ''),
                payload,
                recovered: true
            };
            queued.set(id, job);
            queue.push(job);
            setProgress(id, job.userId, {
                task: 'generate',
                status: 'running',
                percent: Math.max(1, Number(row.percent || 1)),
                stage: 'Resuming course generation',
                detail: 'Generation is resuming automatically after the platform restart.',
                modelStatus: 'queued'
            });
            logger.info('scorm_ai_job_recovered', { module: 'scorm', progressId: id });
        }
        if (queue.length) setImmediate(pump);

        const terminalCutoff = new Date(Date.now() - TERMINAL_KEEP_MS);
        ScormGenerationJob.destroy({
            where: {
                status: { [Op.in]: ['complete', 'error', 'failed', 'cancelled'] },
                updatedAt: { [Op.lt]: terminalCutoff }
            }
        }).catch(() => {});
    } catch (error) {
        // During a first deployment the table can briefly be unavailable before
        // sequelize.sync() finishes. The next recovery tick will try again.
        logger.warn('scorm_ai_job_recovery_failed', { module: 'scorm', error: error.message });
    } finally {
        recoveryRunning = false;
    }
}

function startRecoveryLoop() {
    if (recoveryTimer) return;
    recoveryTimer = setInterval(() => {
        heartbeatLeases().catch(() => {});
        recoverPersistedJobs().catch(() => {});
    }, RECOVERY_INTERVAL_MS);
    recoveryTimer.unref?.();
    setTimeout(() => recoverPersistedJobs().catch(() => {}), 500).unref?.();
}

function finishActive(progressId) {
    const entry = active.get(progressId);
    if (entry?.child?.connected) {
        try { entry.child.disconnect(); } catch (_) {}
    }
    active.delete(progressId);
    if (!shuttingDown) setImmediate(pump);
}

function startJob(job) {
    if (shuttingDown) return;
    queued.delete(job.progressId);

    const child = fork(childPath(), [], {
        env: process.env,
        stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });

    const entry = { ...job, child, settled: false };
    active.set(job.progressId, entry);

    const startPatch = {
        task: 'generate',
        status: 'running',
        percent: Math.max(2, Number(getMemoryProgress(job.progressId, job.userId)?.percent || 2)),
        stage: job.recovered ? 'Resuming course generation' : 'Preparing final course',
        detail: job.recovered
            ? 'The course generation worker has restarted and is continuing the saved request.'
            : 'Course generation is running in an isolated worker so the platform stays responsive.',
        modelStatus: 'running'
    };
    setProgress(job.progressId, job.userId, startPatch);
    updateDurableJob(job.progressId, {
        status: 'running',
        percent: startPatch.percent,
        stage: startPatch.stage,
        detail: startPatch.detail,
        modelStatus: 'running',
        errorMessage: null
    }).catch(() => {});

    const settle = (kind, payload) => {
        if (entry.settled) return;
        entry.settled = true;

        if (kind === 'complete') {
            const patch = {
                task: 'generate',
                status: 'complete',
                percent: 100,
                stage: 'Course ready',
                detail: 'The generated SCORM course is ready to open.',
                modelStatus: 'succeeded',
                result: payload || null
            };
            setProgress(job.progressId, job.userId, patch);
            updateDurableJob(job.progressId, {
                status: 'complete',
                percent: 100,
                stage: patch.stage,
                detail: patch.detail,
                modelStatus: 'succeeded',
                result: payload || null,
                errorMessage: null,
                leaseOwner: null,
                leaseExpiresAt: null
            }, false).catch(() => {});
            logger.info('scorm_ai_worker_complete', {
                module: 'scorm',
                progressId: job.progressId,
                packageId: payload?.packageId || null,
                courseId: payload?.courseId || null
            });
        } else if (kind === 'cancelled') {
            const cancelled = cancelProgress(job.progressId, job.userId);
            updateDurableJob(job.progressId, {
                status: 'cancelled',
                stage: cancelled?.stage || 'Generation stopped',
                detail: cancelled?.detail || 'Course generation was stopped by the user.',
                modelStatus: 'cancelled',
                cancelledAt: new Date(),
                leaseOwner: null,
                leaseExpiresAt: null
            }, false).catch(() => {});
            logger.info('scorm_ai_worker_cancelled', { module: 'scorm', progressId: job.progressId });
        } else {
            const error = generationError(payload || {});
            failProgress(job.progressId, job.userId, error);
            updateDurableJob(job.progressId, {
                status: 'error',
                stage: 'Generation failed',
                detail: error.message,
                modelStatus: 'failed',
                errorMessage: error.message,
                leaseOwner: null,
                leaseExpiresAt: null
            }, false).catch(() => {});
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
            const patch = {
                task: 'generate',
                status: 'running',
                ...(message.patch || {})
            };
            const current = setProgress(job.progressId, job.userId, patch);
            updateDurableJob(job.progressId, {
                status: 'running',
                percent: current?.percent || patch.percent || 2,
                stage: current?.stage || patch.stage || 'Generating course',
                detail: current?.detail || patch.detail || '',
                modelStatus: current?.modelStatus || patch.modelStatus || 'running'
            }).catch(() => {});
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

    child.on('error', (error) => {
        if (shuttingDown) return;
        settle('error', { message: error.message, code: 'SCORM_WORKER_START_FAILED' });
    });
    child.on('exit', (code, signal) => {
        if (entry.settled) return;
        if (shuttingDown) {
            // Do not mark a deployment restart as a learner-facing failure and do
            // not delete the uploaded source. Releasing the lease lets the next
            // service instance resume this job automatically.
            updateDurableJob(job.progressId, {
                status: 'queued',
                stage: 'Waiting for service restart',
                detail: 'Course generation will resume automatically.',
                modelStatus: 'queued',
                leaseOwner: null,
                leaseExpiresAt: new Date(0)
            }, false).catch(() => {});
            finishActive(job.progressId);
            return;
        }
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
    if (shuttingDown) return;
    while (active.size < concurrency() && queue.length) {
        const next = queue.shift();
        if (!next || !queued.has(next.progressId)) continue;
        startJob(next);
    }
}

async function enqueue({ progressId, userId, payload }) {
    startRecoveryLoop();
    const id = cleanId(progressId);
    if (!id) {
        const error = new Error('A valid progressId is required for background generation.');
        error.code = 'SCORM_PROGRESS_ID_REQUIRED';
        throw error;
    }
    if (active.has(id) || queued.has(id)) return { accepted: true, progressId: id, duplicate: true };

    try {
        const existing = await ScormGenerationJob.findByPk(id);
        if (existing) {
            if (String(existing.userId || '') !== String(userId || '')) {
                const error = new Error('Generation job belongs to another account.');
                error.code = 'SCORM_PROGRESS_FORBIDDEN';
                throw error;
            }
            const status = String(existing.status || '');
            if (['queued', 'running'].includes(status)) {
                return { accepted: true, progressId: id, duplicate: true, status };
            }
            if (status === 'complete') {
                return { accepted: true, progressId: id, duplicate: true, status: 'complete' };
            }
        }
    } catch (error) {
        if (error.code === 'SCORM_PROGRESS_FORBIDDEN') throw error;
        logger.warn('scorm_ai_durable_lookup_failed', { module: 'scorm', progressId: id, error: error.message });
    }

    const job = { progressId: id, userId: String(userId || ''), payload: payload || {} };
    const waiting = active.size >= concurrency();
    const stage = waiting ? 'Queued for generation' : 'Starting generation';
    const detail = waiting
        ? 'Your course is queued. You can continue using the platform while it waits for an available generation worker.'
        : 'Starting an isolated course generation worker.';

    try {
        await createDurableJob(job, stage, detail);
    } catch (error) {
        // Keep the existing in-process path as a compatibility fallback if the
        // durable table cannot be reached. Normal production operation uses the
        // database row so deployments no longer erase the job.
        logger.warn('scorm_ai_durable_enqueue_failed', { module: 'scorm', progressId: id, error: error.message });
    }

    queued.set(id, job);
    queue.push(job);
    setProgress(id, userId, {
        task: 'generate',
        status: 'running',
        percent: 1,
        stage,
        detail,
        modelStatus: 'queued'
    });
    setImmediate(pump);
    return { accepted: true, progressId: id, duplicate: false, status: 'queued' };
}

async function cancel(progressId, userId) {
    startRecoveryLoop();
    const id = cleanId(progressId);
    if (!id) return null;

    let payload = null;
    if (queued.has(id)) {
        const job = queued.get(id);
        payload = job?.payload || null;
        queued.delete(id);
        const index = queue.findIndex((candidate) => candidate.progressId === id);
        if (index >= 0) queue.splice(index, 1);
    }

    const entry = active.get(id);
    if (entry) {
        payload = entry.payload || payload;
        entry.cancelRequested = true;
        try { entry.child.send({ type: 'cancel', progressId: id }); } catch (_) {}
        const timer = setTimeout(() => {
            const current = active.get(id);
            if (current && !current.settled) {
                try { current.child.kill('SIGTERM'); } catch (_) {}
            }
        }, 1500);
        timer.unref?.();
    }

    let persisted = null;
    try {
        persisted = await ScormGenerationJob.findByPk(id);
        if (persisted && String(persisted.userId || '') !== String(userId || '')) return null;
        if (!payload && persisted) payload = parseJson(persisted.payloadJson, null);
    } catch (_) {}

    const cancelled = cancelProgress(id, userId) || {
        id,
        userId: String(userId || ''),
        task: 'generate',
        status: 'cancelled',
        percent: persisted?.percent || 1,
        stage: 'Generation stopped',
        detail: 'Course generation was stopped by the user.',
        modelStatus: 'cancelled',
        cancelledAt: Date.now(),
        updatedAt: Date.now()
    };
    await updateDurableJob(id, {
        status: 'cancelled',
        stage: cancelled.stage,
        detail: cancelled.detail,
        modelStatus: 'cancelled',
        cancelledAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null
    }, false);
    cleanupSource(payload);
    return cancelled;
}

async function getProgress(progressId, userId) {
    startRecoveryLoop();
    const id = cleanId(progressId);
    if (!id) return null;
    const memory = getMemoryProgress(id, userId);
    if (memory) return memory;
    try {
        const row = await ScormGenerationJob.findByPk(id);
        if (!row || String(row.userId || '') !== String(userId || '')) return null;
        const progress = rowProgress(row);
        if (progress && ['queued', 'running'].includes(progress.status)) {
            setProgress(id, userId, progress);
        }
        return progress;
    } catch (error) {
        logger.warn('scorm_ai_durable_progress_read_failed', { module: 'scorm', progressId: id, error: error.message });
        return null;
    }
}

function stats() {
    startRecoveryLoop();
    return {
        queued: queued.size,
        active: active.size,
        concurrency: concurrency(),
        durableRecovery: true
    };
}

function beginShutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    if (recoveryTimer) {
        clearInterval(recoveryTimer);
        recoveryTimer = null;
    }
    const ids = [...new Set([...active.keys(), ...queued.keys()])];
    if (ids.length) {
        ScormGenerationJob.update({
            status: 'queued',
            stage: 'Waiting for service restart',
            detail: 'Course generation will resume automatically.',
            modelStatus: 'queued',
            leaseOwner: null,
            leaseExpiresAt: new Date(0)
        }, {
            where: {
                progressId: { [Op.in]: ids },
                leaseOwner: INSTANCE_ID,
                status: { [Op.in]: ['queued', 'running'] }
            }
        }).catch(() => {});
    }
}

process.once('SIGTERM', beginShutdown);
process.once('SIGINT', beginShutdown);

module.exports = { enqueue, cancel, getProgress, stats, recoverPersistedJobs };
