const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { featureFlags, scormMaxUploadMb } = require('../../config/featureFlags');
const { cleanId } = require('../../services/scorm/ScormGenerationProgress');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const ScormGenerationJob = require('../../models/scorm/ScormGenerationJob');
const ScormAiGenerationManager = require('../../jobs/ScormAiGenerationManager');
const {
    isBillableAiGenerationPayload,
    generationSource,
    reserveAiCourseGeneration,
    finalizeAiCourseGeneration,
    usageOperationKey
} = require('../../services/scorm/ScormAiUsageService');

const COURSE_GENERATION_RELEASE = 'gemini-course-durable-v5';
let generationStoreReadyPromise = null;

// Routes are mounted after database initialisation, so starting the recovery
// loop here safely resumes any generation lease left behind by a deployment.
ScormAiGenerationManager.stats();

function sourceKey(userId, progressId) {
    return `ai-author/source/${String(userId || 'unknown')}/${progressId}.bin`;
}

function visualPdfSourceKey(userId, progressId) {
    return `ai-author/source/${String(userId || 'unknown')}/${progressId}-visual.pdf`;
}

function isPdfBuffer(value) {
    return Buffer.isBuffer(value) && value.length >= 5 && value.subarray(0, 5).toString('ascii') === '%PDF-';
}

function storageUnavailableError(cause = null) {
    const error = new Error('Course generation storage is temporarily unavailable. Please retry in a moment.');
    error.code = 'SCORM_GENERATION_STORAGE_UNAVAILABLE';
    if (cause) error.cause = cause;
    return error;
}

async function ensureGenerationStoreReady() {
    if (!generationStoreReadyPromise) {
        generationStoreReadyPromise = ScormGenerationJob.sync()
            .catch((error) => {
                generationStoreReadyPromise = null;
                throw storageUnavailableError(error);
            });
    }
    return generationStoreReadyPromise;
}

async function assertDurableGenerationJob(progressId, userId) {
    try {
        const row = await ScormGenerationJob.findByPk(progressId, {
            attributes: ['progressId', 'userId']
        });
        if (!row || String(row.userId || '') !== String(userId || '')) {
            throw storageUnavailableError();
        }
        return true;
    } catch (error) {
        if (error?.code === 'SCORM_GENERATION_STORAGE_UNAVAILABLE') throw error;
        throw storageUnavailableError(error);
    }
}

async function durableStoreAvailable(progressId) {
    try {
        await ScormGenerationJob.findByPk(progressId, {
            attributes: ['progressId'],
            raw: true
        });
        return true;
    } catch (_) {
        return false;
    }
}

// Lightweight public marker for confirming which course-generation backend is
// actually serving the custom API domain. It never exposes credentials.
router.get('/version', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        ok: true,
        release: COURSE_GENERATION_RELEASE,
        commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
        textModel: process.env.GOOGLE_TEXT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        imageModel: process.env.GOOGLE_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
    });
});

router.post(
    '/source/:progressId/visual-pdf',
    auth,
    express.raw({ type: 'application/octet-stream', limit: `${scormMaxUploadMb()}mb` }),
    async (req, res) => {
        if (!featureFlags.scormAiAuthor) return res.status(403).json({ message: 'AI author is disabled.' });
        const progressId = cleanId(req.params.progressId);
        if (!progressId) return res.status(400).json({ message: 'Invalid progressId.', code: 'SCORM_PROGRESS_ID_REQUIRED' });
        if (!isPdfBuffer(req.body)) {
            return res.status(400).json({
                message: 'The exact visual source must be a valid PDF exported from the presentation.',
                code: 'SCORM_PRESENTATION_VISUAL_PDF_INVALID'
            });
        }

        try {
            const key = visualPdfSourceKey(req.userId, progressId);
            const storage = getObjectStorage();
            await storage.putObject({ key, body: req.body, contentType: 'application/pdf' });
            res.setHeader('Cache-Control', 'no-store');
            return res.status(201).json({
                ok: true,
                sourceKey: key,
                mimeType: 'application/pdf',
                byteSize: req.body.length
            });
        } catch (error) {
            return res.status(500).json({
                message: error.message || 'Unable to store exact visual PDF.',
                code: error.code || 'SCORM_VISUAL_SOURCE_UPLOAD_FAILED'
            });
        }
    }
);

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

router.post('/generate', auth, async (req, res) => {
    if (!featureFlags.scormAiAuthor) return res.status(403).json({ message: 'AI author is disabled.' });

    const progressId = cleanId(req.body?.progressId);
    if (!progressId) {
        return res.status(400).json({
            message: 'A valid progressId is required for background course generation.',
            code: 'SCORM_PROGRESS_ID_REQUIRED'
        });
    }

    const payload = req.body || {};
    const operationKey = usageOperationKey(progressId);
    let usageReserved = false;
    let enqueued = false;
    try {
        // The durable generation table is required for every accepted background
        // job. sync() is create-if-missing only here; it does not alter columns.
        await ensureGenerationStoreReady();

        if (isBillableAiGenerationPayload(payload)) {
            const isReplacement = Boolean(payload.replacePackageId || payload.packageId);
            const reservation = await reserveAiCourseGeneration({
                hostId: req.userId,
                entitlementEmail: req.scormEntitlementEmail,
                entitlement: req.scormEntitlement,
                operationKey,
                source: generationSource(payload),
                reserveActiveSlot: !isReplacement,
                metadata: { courseMode: String(payload.courseMode || 'generated').slice(0, 40) }
            });
            usageReserved = !reservation.duplicate;
        }

        const queued = await ScormAiGenerationManager.enqueue({
            progressId,
            userId: req.userId,
            payload
        });
        enqueued = true;

        // A 202 means the browser is safe to poll this job from any service
        // instance. Never acknowledge the request until its durable row exists.
        try {
            await assertDurableGenerationJob(progressId, req.userId);
        } catch (error) {
            await ScormAiGenerationManager.cancel(progressId, req.userId).catch(() => {});
            throw error;
        }

        res.setHeader('Cache-Control', 'no-store');
        return res.status(202).json({
            ok: true,
            accepted: true,
            status: queued.status || 'queued',
            progressId,
            release: COURSE_GENERATION_RELEASE,
            duplicate: Boolean(queued.duplicate),
            worker: ScormAiGenerationManager.stats()
        });
    } catch (error) {
        if (usageReserved && !enqueued) {
            await finalizeAiCourseGeneration(operationKey, { status: 'released' }).catch(() => {});
        }
        const status = Number(error.status) || (error.code === 'SCORM_PROGRESS_FORBIDDEN'
            ? 403
            : error.code === 'SCORM_GENERATION_STORAGE_UNAVAILABLE'
                ? 503
                : 500);
        return res.status(status).json({
            message: error.message || 'Unable to queue course generation.',
            code: error.code || 'SCORM_GENERATION_QUEUE_FAILED',
            release: COURSE_GENERATION_RELEASE
        });
    }
});

// This route is mounted before the older in-memory author route. New jobs are
// read from the durable generation table when the current process has restarted,
// so a deployment no longer turns an active course into a false 404/failure.
router.get('/progress/:progressId', auth, async (req, res, next) => {
    const progressId = cleanId(req.params.progressId);
    if (!progressId) return res.status(400).json({ ok: false, message: 'Invalid progressId.', code: 'SCORM_PROGRESS_ID_REQUIRED' });

    try {
        const progress = await ScormAiGenerationManager.getProgress(progressId, req.userId);
        if (progress) {
            res.setHeader('Cache-Control', 'no-store');
            return res.json({ ok: true, progress, release: COURSE_GENERATION_RELEASE });
        }

        // getProgress deliberately tolerates database errors so workers can keep
        // running. Before falling through to the legacy 404 route, distinguish a
        // missing job from an unavailable durable progress store.
        if (!(await durableStoreAvailable(progressId))) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(503).json({
                ok: false,
                message: 'Course generation progress is temporarily unavailable. Please retry.',
                code: 'SCORM_GENERATION_STORAGE_UNAVAILABLE',
                release: COURSE_GENERATION_RELEASE
            });
        }

        return next();
    } catch (error) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(503).json({
            ok: false,
            message: 'Course generation progress is temporarily unavailable. Please retry.',
            code: error.code || 'SCORM_GENERATION_STORAGE_UNAVAILABLE',
            release: COURSE_GENERATION_RELEASE
        });
    }
});

router.post('/progress/:progressId/cancel', auth, async (req, res, next) => {
    try {
        const progress = await ScormAiGenerationManager.getProgress(req.params.progressId, req.userId);
        if (!progress) return next();
        if (progress.status === 'complete') return res.status(409).json({ ok: false, message: 'This course is already complete.', progress });
        if (progress.status === 'error') return res.status(409).json({ ok: false, message: 'This generation has already failed.', progress });
        if (progress.status === 'cancelled') return res.json({ ok: true, progress });

        const cancelled = await ScormAiGenerationManager.cancel(req.params.progressId, req.userId);
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, progress: cancelled || progress, release: COURSE_GENERATION_RELEASE });
    } catch (_) {
        return next();
    }
});

module.exports = router;
