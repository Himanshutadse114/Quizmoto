const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags, scormMaxUploadMb } = require('../../config/featureFlags');
const { cleanId, getProgress } = require('../../services/scorm/ScormGenerationProgress');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const ScormAiGenerationManager = require('../../jobs/ScormAiGenerationManager');

function sourceKey(userId, progressId) {
    return `ai-author/source/${String(userId || 'unknown')}/${progressId}.bin`;
}

router.post(
    '/source/:progressId',
    auth,
    express.raw({ type: 'application/octet-stream', limit: `${scormMaxUploadMb()}mb` }),
    async (req, res) => {
        if (!featureFlags.scormAiAuthor) return res.status(403).json({ message: 'AI author is disabled.' });
        const progressId = cleanId(req.params.progressId);
        if (!progressId) return res.status(400).json({ message: 'Invalid progressId.', code: 'SCORM_PROGRESS_ID_REQUIRED' });
        if (!Buffer.isBuffer(req.body) || !req.body.length) {
            return res.status(400).json({ message: 'Source file is empty.', code: 'SCORM_SOURCE_EMPTY' });
        }

        try {
            const key = sourceKey(req.userId, progressId);
            const mimeType = String(req.headers['x-source-mime'] || 'application/octet-stream').slice(0, 180);
            const storage = getObjectStorage();
            await storage.putObject({ key, body: req.body, contentType: mimeType });
            res.setHeader('Cache-Control', 'no-store');
            return res.status(201).json({
                ok: true,
                sourceKey: key,
                mimeType,
                byteSize: req.body.length
            });
        } catch (error) {
            return res.status(500).json({
                message: error.message || 'Unable to store source file.',
                code: error.code || 'SCORM_SOURCE_UPLOAD_FAILED'
            });
        }
    }
);

router.post('/generate', auth, (req, res) => {
    if (!featureFlags.scormAiAuthor) return res.status(403).json({ message: 'AI author is disabled.' });

    const progressId = cleanId(req.body?.progressId);
    if (!progressId) {
        return res.status(400).json({
            message: 'A valid progressId is required for background course generation.',
            code: 'SCORM_PROGRESS_ID_REQUIRED'
        });
    }

    try {
        const queued = ScormAiGenerationManager.enqueue({
            progressId,
            userId: req.userId,
            payload: req.body || {}
        });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(202).json({
            ok: true,
            accepted: true,
            status: 'queued',
            progressId,
            duplicate: Boolean(queued.duplicate),
            worker: ScormAiGenerationManager.stats()
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Unable to queue course generation.',
            code: error.code || 'SCORM_GENERATION_QUEUE_FAILED'
        });
    }
});

router.post('/progress/:progressId/cancel', auth, (req, res, next) => {
    const progress = getProgress(req.params.progressId, req.userId);
    if (!progress) return next();
    if (progress.status === 'complete') return res.status(409).json({ ok: false, message: 'This course is already complete.', progress });
    if (progress.status === 'error') return res.status(409).json({ ok: false, message: 'This generation has already failed.', progress });

    const cancelled = ScormAiGenerationManager.cancel(req.params.progressId, req.userId);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, progress: cancelled || progress });
});

module.exports = router;
