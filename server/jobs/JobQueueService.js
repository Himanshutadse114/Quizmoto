/**
 * Phase 3 — durable job queue foundation.
 *
 * Backends:
 * - memory (default): works in tests and single-process without Redis
 * - redis: when REDIS_URL is set, uses a Redis list for cross-process dequeue
 *
 * Job status is always tracked in a process-local registry (and mirrored to Redis
 * hashes when available) so GET status works without requiring BullMQ.
 *
 * REPORTS_ASYNC flag does NOT enable this by itself — callers decide when to enqueue.
 * This module never blocks live session paths.
 */

const crypto = require('crypto');
const { JOB_STATUS } = require('./jobTypes');
const logger = require('../utils/logger');
const Metrics = require('../utils/metrics');

const DEFAULT_QUEUE_KEY = 'quizmoto:jobs:queue';
const STATUS_KEY_PREFIX = 'quizmoto:jobs:status:';
const IDEMPOTENCY_KEY_PREFIX = 'quizmoto:jobs:idemp:';

/** @type {Map<string, object>} */
const memoryJobs = new Map();
/** @type {Map<string, string>} jobId by idempotency key */
const memoryIdemp = new Map();
/** @type {string[]} FIFO of pending job ids */
const memoryQueue = [];

/** @type {Map<string, Function>} */
const handlers = new Map();

let redisClient = null;
let redisReady = false;
let redisInitAttempted = false;

function newJobId() {
    return crypto.randomUUID();
}

function nowIso() {
    return new Date().toISOString();
}

async function ensureRedis() {
    if (redisInitAttempted) return redisReady;
    redisInitAttempted = true;

    const url = process.env.REDIS_URL;
    if (!url) {
        redisReady = false;
        return false;
    }

    try {
        const { createClient } = require('redis');
        redisClient = createClient({ url });
        redisClient.on('error', (err) => {
            logger.error('job_redis_error', { module: 'jobs', error: err.message });
        });
        await redisClient.connect();
        redisReady = true;
        logger.info('job_redis_connected', { module: 'jobs' });
        return true;
    } catch (err) {
        logger.warn('job_redis_fallback_memory', { module: 'jobs', error: err.message });
        redisClient = null;
        redisReady = false;
        return false;
    }
}

function serializeJob(job) {
    return JSON.stringify(job);
}

function parseJob(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

async function writeStatus(job) {
    memoryJobs.set(job.id, job);
    if (redisReady && redisClient) {
        await redisClient.set(`${STATUS_KEY_PREFIX}${job.id}`, serializeJob(job), {
            EX: 60 * 60 * 24 * 7
        });
        if (job.idempotencyKey) {
            await redisClient.set(
                `${IDEMPOTENCY_KEY_PREFIX}${job.idempotencyKey}`,
                job.id,
                { EX: 60 * 60 * 24 * 7 }
            );
        }
    }
}

async function readStatus(jobId) {
    if (memoryJobs.has(jobId)) {
        return memoryJobs.get(jobId);
    }
    if (redisReady && redisClient) {
        const raw = await redisClient.get(`${STATUS_KEY_PREFIX}${jobId}`);
        const job = parseJob(raw);
        if (job) memoryJobs.set(jobId, job);
        return job;
    }
    return null;
}

async function findByIdempotencyKey(key) {
    if (!key) return null;
    if (memoryIdemp.has(key)) {
        return readStatus(memoryIdemp.get(key));
    }
    if (redisReady && redisClient) {
        const jobId = await redisClient.get(`${IDEMPOTENCY_KEY_PREFIX}${key}`);
        if (jobId) return readStatus(jobId);
    }
    return null;
}

class JobQueueService {
    static registerHandler(jobType, fn) {
        if (typeof fn !== 'function') {
            throw new Error('Handler must be a function');
        }
        handlers.set(jobType, fn);
    }

    static getHandler(jobType) {
        return handlers.get(jobType) || null;
    }

    static async enqueue({ type, payload = {}, idempotencyKey = null, actorId = null }) {
        if (!type || typeof type !== 'string') {
            const err = new Error('job type is required');
            err.code = 'JOB_VALIDATION';
            throw err;
        }

        await ensureRedis();

        if (idempotencyKey) {
            const existing = await findByIdempotencyKey(idempotencyKey);
            if (existing && existing.status !== JOB_STATUS.FAILED) {
                return { ...existing, replay: true };
            }
        }

        const job = {
            id: newJobId(),
            type,
            payload,
            actorId: actorId != null ? String(actorId) : null,
            idempotencyKey: idempotencyKey || null,
            status: JOB_STATUS.PENDING,
            result: null,
            error: null,
            attempts: 0,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            startedAt: null,
            finishedAt: null
        };

        if (idempotencyKey) {
            memoryIdemp.set(idempotencyKey, job.id);
        }

        await writeStatus(job);

        if (redisReady && redisClient) {
            await redisClient.rPush(DEFAULT_QUEUE_KEY, job.id);
        } else {
            memoryQueue.push(job.id);
        }

        logger.job('job_enqueued', {
            jobId: job.id,
            type: job.type,
            idempotencyKey: job.idempotencyKey || undefined
        });
        Metrics.recordJobEnqueued(job.type);
        Metrics.setQueueDepth(memoryQueue.length);

        return job;
    }

    static async getJob(jobId) {
        await ensureRedis();
        return readStatus(jobId);
    }

    static async dequeue(timeoutSec = 1) {
        await ensureRedis();

        if (redisReady && redisClient) {
            try {
                const result = await redisClient.blPop(DEFAULT_QUEUE_KEY, timeoutSec);
                if (!result) return null;
                return result.element || result.key || null;
            } catch (err) {
                logger.error('job_dequeue_redis_error', { module: 'jobs', error: err.message });
                return null;
            }
        }

        if (memoryQueue.length === 0) {
            await new Promise((r) => setTimeout(r, Math.min(timeoutSec, 1) * 200));
            return memoryQueue.length ? memoryQueue.shift() : null;
        }
        return memoryQueue.shift();
    }

    static async processJob(jobId) {
        const job = await readStatus(jobId);
        if (!job) {
            return { ok: false, code: 'JOB_NOT_FOUND' };
        }
        if (job.status === JOB_STATUS.COMPLETED) {
            return { ok: true, code: 'ALREADY_COMPLETED', job };
        }

        const handler = handlers.get(job.type);
        if (!handler) {
            job.status = JOB_STATUS.FAILED;
            job.error = `No handler registered for type ${job.type}`;
            job.updatedAt = nowIso();
            job.finishedAt = nowIso();
            await writeStatus(job);
            return { ok: false, code: 'NO_HANDLER', job };
        }

        job.status = JOB_STATUS.ACTIVE;
        job.attempts += 1;
        job.startedAt = nowIso();
        job.updatedAt = nowIso();
        await writeStatus(job);

        try {
            const result = await handler(job.payload, job);
            job.status = JOB_STATUS.COMPLETED;
            job.result = result == null ? { ok: true } : result;
            job.error = null;
            job.finishedAt = nowIso();
            job.updatedAt = nowIso();
            await writeStatus(job);
            logger.job('job_completed', {
                jobId: job.id,
                type: job.type,
                attempts: job.attempts
            });
            const durOk = job.startedAt
                ? Date.now() - new Date(job.startedAt).getTime()
                : undefined;
            Metrics.recordJobCompleted(job.type, durOk);
            Metrics.setQueueDepth(memoryQueue.length);
            return { ok: true, code: 'COMPLETED', job };
        } catch (err) {
            job.status = JOB_STATUS.FAILED;
            job.error = err.message || String(err);
            job.finishedAt = nowIso();
            job.updatedAt = nowIso();
            await writeStatus(job);
            logger.job('job_failed', {
                jobId: job.id,
                type: job.type,
                attempts: job.attempts,
                error: job.error
            });
            const durFail = job.startedAt
                ? Date.now() - new Date(job.startedAt).getTime()
                : undefined;
            Metrics.recordJobFailed(job.type, durFail);
            Metrics.setQueueDepth(memoryQueue.length);
            return { ok: false, code: 'FAILED', job };
        }
    }

    static async runWorkerLoop(opts = {}) {
        const stopFn = opts.stopFn || (() => false);
        const idleMs = opts.idleMs || 500;

        logger.info('worker_loop_started', { module: 'jobs' });
        while (!stopFn()) {
            const jobId = await this.dequeue(1);
            if (!jobId) {
                await new Promise((r) => setTimeout(r, idleMs));
                continue;
            }
            try {
                const outcome = await this.processJob(jobId);
                logger.job('job_processed', {
                    jobId,
                    code: outcome.code,
                    type: outcome.job && outcome.job.type
                });
            } catch (err) {
                logger.error('job_process_error', { module: 'jobs', jobId, error: err.message });
            }
        }
        logger.info('worker_loop_stopped', { module: 'jobs' });
    }

    static _resetForTests() {
        memoryJobs.clear();
        memoryIdemp.clear();
        memoryQueue.length = 0;
        handlers.clear();
    }

    static _memoryQueueLength() {
        return memoryQueue.length;
    }
}

module.exports = JobQueueService;
