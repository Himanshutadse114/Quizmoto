const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags } = require('../../config/featureFlags');
const { cleanId, getProgress } = require('../../services/scorm/ScormGenerationProgress');
const ScormAiGenerationManager = require('../../jobs/ScormAiGenerationManager');

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
