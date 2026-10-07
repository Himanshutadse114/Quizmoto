'use strict';
/**
 * LMSGEN Video Studio API.
 *
 * Web version of the VideoForge desktop flow:
 *   1. POST /script  {topic, description, layout} -> 202 {progressId}
 *      ChatGPT writes the blueprint (strict JSON). Cheap; the user reviews it.
 *   2. GET  /jobs/:progressId                    -> {status, percent, stage, result, ...}
 *      Poll until the script is ready, then show the approval UI
 *      (on-screen copy + voiceover per scene, edit, per-scene image upload).
 *   3. POST /upload-ticket {sceneIndex, mimeType, byteSize} -> {uploadUrl, storageKey, ...}
 *      Browser PUTs the custom scene image straight to storage (S3 signed URL
 *      on Render; proxied JSON upload on local driver).
 *   4. POST /build {blueprint, imageKeys} -> 202 {progressId}
 *      NOTHING expensive runs until this call: TTS + images + Python render + upload.
 *   5. GET  /jobs/:buildProgressId/download -> finished MP4 (signed redirect / stream).
 *
 * Mounted as /api/scorm/video-studio (see routes/scorm/index.js).
 */

const crypto = require('crypto');
const router = require('express').Router();

const auth = require('../middleware');
const { cleanId } = require('../../services/scorm/ScormGenerationProgress');
const { runMeteredAiOperation } = require('../../services/scorm/AiOperationGuard');
const { aiVideoScriptLimiter, aiVideoBuildLimiter, aiUploadLimiter } = require('../../middleware/AiAbuseProtection');
const { JOB_TYPES } = require('../../jobs/jobTypes');
const VideoStudioManager = require('../../jobs/VideoStudioManager');
const VideoStudioService = require('../../services/videoStudio/VideoStudioService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { prepareDirectUpload, redirectToSignedObject, safeDownloadName } =
    require('../../storage/DirectObjectDelivery');

const ACCEPTED_IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function workspaceRequired(req) {
    if (req.scormWorkspaceId) return;
    const error = new Error('A workspace is required to use Video Studio.');
    error.status = 400;
    throw error;
}

function newProgressId() {
    return crypto.randomUUID();
}

function safeExtension(mimeType) {
    if (mimeType === 'image/png') return 'png';
    if (imageJpeg(mimeType)) return 'jpg';
    return 'webp';
}
function imageJpeg(mimeType) { return mimeType === 'image/jpeg'; }

/** 202 envelope shared by /script and /build. */
async function enqueueJob(req, res, payload, extra = {}) {
    const progressId = newProgressId();
    const queued = await VideoStudioManager.enqueue({ progressId, userId: req.userId, payload });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(202).json({
        ok: true,
        progressId: queued.progressId,
        status: queued.status || 'queued',
        poll: `/api/scorm/video-studio/jobs/${queued.progressId}`,
        ...extra
    });
}

function progressPayload(progress) {
    if (!progress) return null;
    return {
        progressId: progress.progressId,
        status: progress.status,
        percent: progress.percent,
        stage: progress.stage || null,
        detail: progress.detail || null,
        result: progress.result || null,
        errorMessage: progress.errorMessage || null
    };
}

// --- 1. script ---------------------------------------------------------------
router.post('/script', auth, aiVideoScriptLimiter, async (req, res) => {
    try {
        workspaceRequired(req);
        const topic = String(req.body?.topic || '').trim();
        const description = String(req.body?.description || '').trim().slice(0, 2000);
        const layout = String(req.body?.layout || 'linkedin').trim().toLowerCase();
        const seconds = Math.max(20, Math.min(180, Number(req.body?.seconds) || 60));
        if (!topic) return res.status(422).json({ message: 'A topic is required.', code: 'VIDEO_TOPIC_REQUIRED' });
        if (!VideoStudioService.LAYOUTS.includes(layout)) {
            return res.status(422).json({
                message: `Unknown layout. Choose one of: ${VideoStudioService.LAYOUTS.join(', ')}.`,
                code: 'VIDEO_LAYOUT_UNKNOWN'
            });
        }
        // Reserve the AI-usage slot before queueing (metered like course generation).
        await runMeteredAiOperation(req, { kind: 'video_script', source: 'video-studio' }, async () => ({}));
        return await enqueueJob(req, res, {
            kind: JOB_TYPES.VIDEO_SCRIPT,
            topic, description, layout, seconds
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || 'Unable to start script generation.',
            code: error.code || undefined
        });
    }
});

// --- 2. job status ------------------------------------------------------------
router.get('/jobs/:progressId', auth, async (req, res) => {
    try {
        const progressId = cleanId(req.params.progressId);
        if (!progressId) return res.status(400).json({ message: 'Invalid job id.' });
        const progress = await VideoStudioManager.getProgress(progressId, req.userId);
        if (!progress) return res.status(404).json({ message: 'Video job not found.' });
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, job: progressPayload(progress) });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Unable to read job status.' });
    }
});

router.post('/jobs/:progressId/cancel', auth, async (req, res) => {
    try {
        const progressId = cleanId(req.params.progressId);
        if (!progressId) return res.status(400).json({ message: 'Invalid job id.' });
        await VideoStudioManager.cancel(progressId, req.userId);
        return res.json({ ok: true });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Unable to cancel job.' });
    }
});

// --- 3. per-scene custom image upload ticket -----------------------------------
// Note: uploads use the general upload limiter (30/hr), not the script limiter:
// a 5-scene video needs 5 ticket calls plus the script call itself.
router.post('/upload-ticket', auth, aiUploadLimiter, async (req, res) => {
    try {
        workspaceRequired(req);
        const sceneIndex = Number(req.body?.sceneIndex);
        const mimeType = String(req.body?.mimeType || '').split(';')[0].trim().toLowerCase();
        const byteSize = Number(req.body?.byteSize || 0);
        if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex > 9) {
            return res.status(422).json({ message: 'sceneIndex must be an integer 0-9.' });
        }
        if (!ACCEPTED_IMAGE.has(mimeType)) {
            return res.status(415).json({ message: 'Upload a PNG, JPEG or WebP image.' });
        }
        if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > MAX_IMAGE_BYTES) {
            return res.status(413).json({ message: 'Image must be between 1 byte and 20 MB.' });
        }
        const storage = getObjectStorage();
        const storageKey = `video-studio/uploads/${req.userId}/${Date.now()}-${sceneIndex}.${safeExtension(mimeType)}`;
        if (await prepareDirectUpload(storage)) {
            const uploadUrl = await storage.createSignedPutUrl(storageKey, { expiresIn: 15 * 60, contentType: mimeType });
            res.setHeader('Cache-Control', 'private, no-store');
            return res.status(201).json({
                direct: true, uploadUrl, storageKey, mimeType,
                headers: { 'Content-Type': mimeType }, expiresIn: 15 * 60
            });
        }
        // Local driver: no signed PUTs - the browser POSTs base64 to /upload instead.
        return res.status(201).json({ direct: false, storageKey, maxBytes: MAX_IMAGE_BYTES });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Unable to prepare image upload.' });
    }
});

/** Base64 fallback for the local storage driver (mirrors the repo's upload-json pattern). */
router.post('/upload', auth, aiUploadLimiter, async (req, res) => {
    try {
        workspaceRequired(req);
        const storageKey = String(req.body?.storageKey || '');
        const dataUrl = String(req.body?.dataUrl || '');
        if (!/^video-studio\/uploads\//.test(storageKey)) {
            return res.status(422).json({ message: 'Invalid storage key.' });
        }
        const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match) return res.status(422).json({ message: 'Expected a PNG/JPEG/WebP data URL.' });
        const body = Buffer.from(match[2], 'base64');
        if (body.length === 0 || body.length > MAX_IMAGE_BYTES) {
            return res.status(413).json({ message: 'Image must be between 1 byte and 20 MB.' });
        }
        const storage = getObjectStorage();
        await storage.putObject({ key: storageKey, body, contentType: match[1] });
        return res.status(201).json({ ok: true, storageKey });
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Unable to save image.' });
    }
});

// --- 4. build (the approval gate: nothing expensive runs before this call) -----
router.post('/build', auth, aiVideoBuildLimiter, async (req, res) => {
    try {
        workspaceRequired(req);
        const blueprint = req.body?.blueprint;
        const imageKeys = req.body?.imageKeys && typeof req.body.imageKeys === 'object' ? req.body.imageKeys : {};
        const voice = String(req.body?.voice || 'onyx').trim().toLowerCase();
        VideoStudioService.validateBlueprint(blueprint, (blueprint && blueprint.scenes || []).length, blueprint && blueprint.layout);
        for (const [sceneIdx, key] of Object.entries(imageKeys)) {
            if (!/^video-studio\/uploads\//.test(String(key))) {
                return res.status(422).json({ message: `Invalid image key for scene ${sceneIdx}.` });
            }
        }
        // Budget gate: estimate BEFORE anything is spent; 402 if over budget.
        const estimate = VideoStudioService.assertVideoBudget(blueprint, imageKeys);
        await runMeteredAiOperation(req, { kind: 'video_build', source: 'video-studio' }, async () => ({}));
        return await enqueueJob(req, res, {
            kind: JOB_TYPES.VIDEO_BUILD,
            blueprint,
            imageKeys,
            voice
        }, {
            estimatedCostUsd: Number(estimate.total.toFixed(4)),
            estimatedCostInr: Math.round(estimate.total * VideoStudioService.USD_TO_INR),
            budgetInr: VideoStudioService.videoBudget().budgetInr
        });
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.message || 'Unable to start video build.',
            code: error.code || undefined
        });
    }
});

// --- 5. download ----------------------------------------------------------------
router.get('/jobs/:progressId/download', auth, async (req, res) => {
    try {
        const progressId = cleanId(req.params.progressId);
        if (!progressId) return res.status(400).json({ message: 'Invalid job id.' });
        const progress = await VideoStudioManager.getProgress(progressId, req.userId);
        const storageKey = progress && progress.result && progress.result.storageKey;
        if (!progress || progress.status !== 'complete' || !storageKey) {
            return res.status(404).json({ message: 'Finished video not found.' });
        }
        const storage = getObjectStorage();
        const filename = safeDownloadName(`lmsgen-video-${progressId.slice(0, 8)}.mp4`, 'video.mp4');
        if (await redirectToSignedObject(res, storage, storageKey, { downloadName: filename })) return;
        // Local driver fallback: stream through the API.
        const { stream, contentLength } = await storage.getObjectStream(storageKey);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        stream.pipe(res);
    } catch (error) {
        return res.status(error.status || 500).json({ message: error.message || 'Unable to download video.' });
    }
});

router.get('/layouts', auth, async (_req, res) => {
    return res.json({ ok: true, layouts: VideoStudioService.LAYOUTS });
});

module.exports = router;
