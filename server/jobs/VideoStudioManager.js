'use strict';
/**
 * LMSGEN Video Studio - background job manager.
 *
 * Mirrors the proven ScormAiGenerationManager pattern (durable ScormGenerationJob
 * rows + forked child worker + in-memory progress channel), but dedicated to the
 * two video-studio job kinds:
 *   - VIDEO_SCRIPT: ChatGPT writes the blueprint (seconds).
 *   - VIDEO_BUILD:  TTS + images + Python render + upload (minutes).
 *
 * Jobs are forked children of this process so a long render never blocks the
 * web request cycle. Progress is polled via GET /api/scorm/video-studio/jobs/:progressId.
 */

const crypto = require('crypto');
const path = require('path');
const { fork } = require('child_process');
const { Op } = require('sequelize');

const {
    cleanId,
    setProgress,
    getProgress: getMemoryProgress,
    cancelProgress
} = require('../services/scorm/ScormGenerationProgress');
const ScormGenerationJob = require('../models/scorm/ScormGenerationJob');
const logger = require('../utils/logger');
const { JOB_TYPES } = require('./jobTypes');

const INSTANCE_ID = `videostudio-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
const LEASE_MS = Math.max(20000, Number(process.env.VIDEO_STUDIO_LEASE_MS || 120000));
const RECOVERY_INTERVAL_MS = Math.max(5000, Number(process.env.VIDEO_STUDIO_RECOVERY_MS || 15000));
const TERMINAL_KEEP_MS = 24 * 60 * 60 * 1000;

const queue = [];
const active = new Map();   // progressId -> { child, job }
const queued = new Map();   // progressId -> job
let recoveryTimer = null;
let recoveryRunning = false;

function isVideoStudioKind(kind) {
    return kind === JOB_TYPES.VIDEO_SCRIPT || kind === JOB_TYPES.VIDEO_BUILD;
}

function concurrency() {
    const configured = Number(process.env.VIDEO_STUDIO_CONCURRENCY || 1);
    return Math.max(1, Math.min(2, Number.isFinite(configured) ? Math.floor(configured) : 1));
}

function childPath() {
    return path.join(__dirname, 'videoStudioChild.js');
}

function leaseUntil() {
    return new Date(Date.now() + LEASE_MS);
}

function clampPercent(value, fallback = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return Math.max(1, Number(fallback) || 1);
    return Math.max(1, Math.min(100, Math.round(n)));
}

function safeJson(value, fallback = null) {
    try { return JSON.stringify(value == null ? fallback : value); }
    catch (_) { return JSON.stringify(fallback); }
}

function parseJson(value, fallback = null) {
    if (!value) return fallback;
    try { return JSON.parse(String(value)); }
    catch (_) { return fallback; }
}

async function updateDurableJob(progressId, patch = {}) {
    try {
        await ScormGenerationJob.update(
            { ...patch, leaseOwner: INSTANCE_ID, leaseExpiresAt: leaseUntil() },
            { where: { progressId } }
        );
    } catch (error) {
        logger.warn('video_studio_durable_update_failed', { module: 'video-studio', progressId, error: error.message });
    }
}

function finishActive(progressId) {
    const entry = active.get(progressId);
    if (entry) {
        try { entry.child.kill('SIGTERM'); } catch (_) { /* already gone */ }
        active.delete(progressId);
    }
    queued.delete(progressId);
    pump();
}

function pump() {
    while (active.size < concurrency() && queue.length > 0) {
        const job = queue.shift();
        queued.delete(job.progressId);
        startJob(job);
    }
}

function startJob(job) {
    const { progressId, userId, payload } = job;
    setProgress(progressId, userId, {
        status: 'running', percent: 2, stage: 'Starting', detail: 'Starting an isolated video worker.'
    });
    updateDurableJob(progressId, { status: 'running', percent: 2, stage: 'Starting' });

    let child;
    try {
        child = fork(childPath(), [], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    } catch (error) {
        failJob(job, error);
        return;
    }
    active.set(progressId, { child, job });

    child.on('message', (message) => {
        if (!message || typeof message !== 'object' || message.progressId !== progressId) return;
        if (message.type === 'progress') {
            const patch = message.patch || {};
            setProgress(progressId, userId, {
                status: 'running',
                percent: clampPercent(patch.percent, 2),
                stage: patch.stage || undefined,
                detail: patch.detail || undefined
            });
            updateDurableJob(progressId, {
                status: 'running',
                percent: clampPercent(patch.percent, 2),
                stage: patch.stage || null,
                detail: patch.detail || null
            });
        } else if (message.type === 'complete') {
            const result = message.result || {};
            setProgress(progressId, userId, {
                status: 'complete', percent: 100, stage: 'Done', detail: 'Finished.', result
            });
            updateDurableJob(progressId, {
                status: 'complete', percent: 100, stage: 'Done',
                resultJson: safeJson(result)
            }).finally(() => finishActive(progressId));
        } else if (message.type === 'error') {
            failJob(job, new Error(message.message || 'Video job failed.'));
        }
    });

    child.on('exit', (code) => {
        if (!active.has(progressId)) return; // already completed/failed
        failJob(job, new Error(`Video worker exited unexpectedly (code ${code}).`));
    });

    child.send({ type: 'run', progressId, userId, payload });
}

function failJob(job, error) {
    const { progressId, userId } = job;
    const message = String((error && error.message) || 'Video job failed.').slice(0, 1200);
    setProgress(progressId, userId, { status: 'error', stage: 'Failed', detail: message });
    updateDurableJob(progressId, { status: 'error', stage: 'Failed', errorMessage: message })
        .finally(() => finishActive(progressId));
    logger.warn('video_studio_job_failed', { module: 'video-studio', progressId, error: message });
}

async function enqueue({ progressId, userId, payload }) {
    startRecoveryLoop();
    const id = cleanId(progressId);
    if (!id) {
        const error = new Error('A valid progressId is required for video jobs.');
        error.code = 'VIDEO_PROGRESS_ID_REQUIRED';
        throw error;
    }
    if (active.has(id) || queued.has(id)) return { accepted: true, progressId: id, duplicate: true };

    try {
        const existing = await ScormGenerationJob.findByPk(id);
        if (existing) {
            if (String(existing.userId || '') !== String(userId || '')) {
                const error = new Error('Video job belongs to another account.');
                error.code = 'VIDEO_PROGRESS_FORBIDDEN';
                throw error;
            }
            const status = String(existing.status || '');
            if (['queued', 'running'].includes(status)) return { accepted: true, progressId: id, duplicate: true, status };
            if (status === 'complete') return { accepted: true, progressId: id, duplicate: true, status: 'complete' };
            if (['error', 'failed', 'cancelled'].includes(status)) return { accepted: true, progressId: id, duplicate: true, status };
        }
    } catch (error) {
        if (error.code === 'VIDEO_PROGRESS_FORBIDDEN') throw error;
        logger.warn('video_studio_durable_lookup_failed', { module: 'video-studio', progressId: id, error: error.message });
    }

    const job = { progressId: id, userId: String(userId || ''), payload: payload || {} };
    const waiting = active.size >= concurrency();
    const stage = waiting ? 'Queued' : 'Starting';
    const detail = waiting
        ? 'Your video job is queued. You can continue using the platform while it waits.'
        : 'Starting an isolated video worker.';

    try {
        await ScormGenerationJob.upsert({
            progressId: id,
            userId: job.userId,
            payloadJson: safeJson(job.payload, '{}'),
            status: 'queued',
            percent: 1,
            stage,
            detail,
            leaseOwner: INSTANCE_ID,
            leaseExpiresAt: leaseUntil()
        });
    } catch (error) {
        logger.warn('video_studio_durable_create_failed', { module: 'video-studio', progressId: id, error: error.message });
    }
    setProgress(id, job.userId, { status: 'queued', percent: 1, stage, detail });
    queued.set(id, job);
    queue.push(job);
    pump();
    return { accepted: true, progressId: id, duplicate: false, status: waiting ? 'queued' : 'running' };
}

async function cancel(progressId, userId) {
    const id = cleanId(progressId);
    if (!id) return null;
    const entry = active.get(id);
    if (entry) {
        try { entry.child.send({ type: 'cancel' }); } catch (_) { /* ignore */ }
    }
    const removed = cancelProgress(id, userId);
    await updateDurableJob(id, { status: 'cancelled', cancelledAt: new Date() });
    if (entry) finishActive(id);
    else { queued.delete(id); const qi = queue.findIndex((j) => j.progressId === id); if (qi >= 0) queue.splice(qi, 1); }
    return removed;
}

async function getProgress(progressId, userId) {
    const id = cleanId(progressId);
    if (!id) return null;
    const memory = getMemoryProgress(id, userId);
    if (memory) return memory;
    // fall back to the durable row (e.g. after a restart on another instance)
    try {
        const row = await ScormGenerationJob.findByPk(id);
        if (!row || String(row.userId || '') !== String(userId || '')) return null;
        return {
            progressId: id,
            status: row.status,
            percent: row.percent,
            stage: row.stage,
            detail: row.detail,
            result: parseJson(row.resultJson, null),
            errorMessage: row.errorMessage
        };
    } catch (_) {
        return null;
    }
}

function startRecoveryLoop() {
    if (recoveryTimer) return;
    recoveryTimer = setInterval(() => {
        if (recoveryRunning) return;
        recoveryRunning = true;
        recoverStaleJobs().catch(() => {}).finally(() => { recoveryRunning = false; });
    }, RECOVERY_INTERVAL_MS);
    recoveryTimer.unref?.();
}

async function recoverStaleJobs() {
    let rows = [];
    try {
        rows = await ScormGenerationJob.findAll({
            where: {
                status: { [Op.in]: ['queued', 'running'] },
                leaseExpiresAt: { [Op.lt]: new Date(Date.now() - LEASE_MS) },
                updatedAt: { [Op.gt]: new Date(Date.now() - TERMINAL_KEEP_MS) }
            },
            limit: 20
        });
    } catch (_) { return; }
    for (const row of rows) {
        const id = cleanId(row.progressId);
        if (!id || active.has(id) || queued.has(id)) continue;
        // Only video-studio rows belong to this manager; course rows are
        // owned by ScormAiGenerationManager and must not be touched here.
        let kind = '';
        try { kind = String(JSON.parse(row.payloadJson || '{}').kind || ''); } catch (_) { /* keep '' */ }
        if (!isVideoStudioKind(kind)) continue;
        logger.info('video_studio_job_recovered', { module: 'video-studio', progressId: id });
        await updateDurableJob(id, {
            status: 'error', stage: 'Interrupted',
            errorMessage: 'The video worker was interrupted. Please retry.'
        });
    }
}

function stats() {
    return {
        instance: INSTANCE_ID,
        active: active.size,
        queued: queue.length,
        concurrency: concurrency()
    };
}

module.exports = { enqueue, cancel, getProgress, stats, isVideoStudioKind };
