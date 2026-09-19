const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { ScormPackage, ScormCourse } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const {
    isDirectUploadEnabled,
    prepareDirectUpload,
    redirectToSignedObject,
    signedReadUrl
} = require('../../storage/DirectObjectDelivery');
const { packageZipKey, packageContentKey } = require('../../services/scorm/storageKeys');
const { scormMaxUploadMb } = require('../../config/featureFlags');
const JobQueueService = require('../../jobs/JobQueueService');
const { JOB_TYPES } = require('../../jobs/jobTypes');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const { deletePackageFromStorage } = require('../../services/scorm/ScormPackageCleanup');
const logger = require('../../utils/logger');

const backgroundUnpackQueue = [];
const backgroundUnpackSet = new Set();
let backgroundUnpackRunning = false;
let backgroundUnpackTimer = null;

function usesDedicatedScormWorker() {
    return process.env.SCORM_DEDICATED_WORKER === '1' && Boolean(process.env.REDIS_URL);
}

function scheduleBackgroundUnpack(packageId) {
    const id = String(packageId);
    if (backgroundUnpackSet.has(id)) return false;

    backgroundUnpackSet.add(id);
    backgroundUnpackQueue.push(id);

    if (!backgroundUnpackRunning && !backgroundUnpackTimer) {
        // Let the upload response flush and give V8 a chance to release the request
        // body before reopening the ZIP from storage.
        backgroundUnpackTimer = setTimeout(() => {
            backgroundUnpackTimer = null;
            drainBackgroundUnpacks().catch((err) => {
                logger.error('scorm_background_queue_failed', {
                    module: 'scorm',
                    error: err.message
                });
            });
        }, 800);
    }
    return true;
}

async function drainBackgroundUnpacks() {
    if (backgroundUnpackRunning) return;
    backgroundUnpackRunning = true;

    try {
        while (backgroundUnpackQueue.length) {
            const packageId = backgroundUnpackQueue.shift();
            try {
                await unpackPackage(packageId);
            } catch (err) {
                logger.error('scorm_bg_unpack_failed', {
                    module: 'scorm',
                    packageId,
                    error: err.message
                });
            } finally {
                backgroundUnpackSet.delete(String(packageId));
            }

            // Only one large package is expanded at a time on the web service and
            // the short yield keeps normal API traffic responsive between jobs.
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    } finally {
        backgroundUnpackRunning = false;
        if (backgroundUnpackQueue.length && !backgroundUnpackTimer) {
            backgroundUnpackTimer = setTimeout(() => {
                backgroundUnpackTimer = null;
                drainBackgroundUnpacks().catch(() => {});
            }, 500);
        }
    }
}

async function enqueueDedicatedUnpack(pkg, hostId, retryToken = '') {
    const suffix = retryToken ? `:${retryToken}` : '';
    return JobQueueService.enqueue({
        type: JOB_TYPES.SCORM_VALIDATE_UNPACK,
        payload: { packageId: pkg.id, hostId },
        idempotencyKey: `scorm-unpack:${pkg.id}${suffix}`
    });
}

async function tryExtractAiAnalysis(zipBuf) {
    try {
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(zipBuf);
        const entry = zip.file('content.json');
        if (!entry) return null;
        const analysis = JSON.parse(await entry.async('string'));
        if (!analysis || !analysis.title || !Array.isArray(analysis.slides)) return null;
        return analysis;
    } catch (_) {
        return null;
    }
}

router.post('/upload-ticket', auth, async (req, res) => {
    try {
        const byteSize = Number(req.body?.byteSize || 0);
        const max = scormMaxUploadMb() * 1024 * 1024;
        if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > max) {
            return res.status(413).json({ message: `Maximum trackable package size is ${scormMaxUploadMb()} MB.` });
        }
        const storage = getObjectStorage();
        if (!(await prepareDirectUpload(storage))) return res.json({ direct: false });
        const pkg = await ScormPackage.create({
            hostId: req.userId,
            title: String(req.body?.title || 'Uploaded package').slice(0, 200),
            status: 'processing',
            source: 'upload',
            byteSize,
            analysisJson: null
        });
        const zipKey = packageZipKey(pkg.id);
        pkg.storageKeyZip = zipKey;
        await pkg.save();
        const uploadUrl = await storage.createSignedPutUrl(zipKey, { expiresIn: 15 * 60, contentType: 'application/zip' });
        res.setHeader('Cache-Control', 'private, no-store');
        res.status(201).json({
            direct: true,
            packageId: pkg.id,
            uploadUrl,
            byteSize,
            headers: { 'Content-Type': 'application/zip' },
            expiresIn: 15 * 60
        });
    } catch (err) {
        logger.error('scorm_upload_ticket_failed', { module: 'scorm', error: err.message });
        res.status(500).json({ message: 'Unable to prepare direct package upload.' });
    }
});

router.post('/:id/upload-complete', auth, async (req, res) => {
    try {
        const pkg = await ScormPackage.findOne({ where: { id: req.params.id, hostId: req.userId, source: 'upload', status: 'processing' } });
        if (!pkg || !pkg.storageKeyZip) return res.status(404).json({ message: 'Pending package upload not found.' });
        const storage = getObjectStorage();
        if (!isDirectUploadEnabled(storage)) return res.status(409).json({ message: 'Direct package upload is unavailable.' });
        const head = await storage.headObject(pkg.storageKeyZip);
        if (Number(head.contentLength) !== Number(pkg.byteSize)) {
            await storage.deleteObject(pkg.storageKeyZip).catch(() => {});
            pkg.status = 'failed';
            pkg.errorMessage = 'The package upload was incomplete.';
            await pkg.save();
            return res.status(400).json({ message: pkg.errorMessage });
        }
        const processInline = process.env.SCORM_PROCESS_INLINE === '1' || process.env.NODE_ENV === 'test' || process.env.REPORTS_PROCESS_INLINE === '1';
        let jobId = null;
        if (processInline) {
            try { await unpackPackage(pkg.id); } catch (error) { logger.error('scorm_inline_unpack_failed', { module: 'scorm', packageId: pkg.id, error: error.message }); }
            await pkg.reload();
        } else if (usesDedicatedScormWorker()) {
            try {
                const job = await enqueueDedicatedUnpack(pkg, req.userId);
                jobId = job.id;
            } catch (error) {
                logger.warn('scorm_unpack_job_enqueue_failed', { module: 'scorm', packageId: pkg.id, error: error.message });
            }
        } else {
            scheduleBackgroundUnpack(pkg.id);
        }
        res.status(201).json({
            packageId: pkg.id,
            status: pkg.status,
            jobId,
            entryHref: pkg.entryHref || null,
            errorMessage: pkg.errorMessage || null,
            source: pkg.source
        });
    } catch (err) {
        logger.error('scorm_direct_upload_complete_failed', { module: 'scorm', packageId: req.params.id, error: err.message });
        res.status(500).json({ message: 'Unable to confirm package upload.' });
    }
});

function rejectProxiedUploadWhenDirect(req, res, next) {
    if (!isDirectUploadEnabled(getObjectStorage())) return next();
    return res.status(409).json({
        message: 'Use the secure direct upload flow for this package.',
        code: 'DIRECT_UPLOAD_REQUIRED'
    });
}

router.post('/upload', auth, rejectProxiedUploadWhenDirect, express.raw({
    type: ['application/zip', 'application/octet-stream'],
    limit: `${scormMaxUploadMb()}mb`
}), async (req, res) => {
    try {
        let zipBuf = null;
        let title = req.query.title || req.headers['x-scorm-title'] || 'Uploaded package';

        if (Buffer.isBuffer(req.body) && req.body.length > 0) {
            zipBuf = req.body;
        } else if (req.body && req.body.zipBase64) {
            zipBuf = Buffer.from(req.body.zipBase64, 'base64');
            title = req.body.title || title;
        }

        if (!zipBuf && req.is('application/json') && req.body?.zipBase64) {
            zipBuf = Buffer.from(req.body.zipBase64, 'base64');
            title = req.body.title || title;
        }

        if (!zipBuf || !zipBuf.length) {
            return res.status(400).json({ message: 'ZIP body required' });
        }

        const max = scormMaxUploadMb() * 1024 * 1024;
        if (zipBuf.length > max) {
            return res.status(413).json({ message: `Max upload ${scormMaxUploadMb()} MB` });
        }

        // Keep the upload request lightweight. Large Storyline/Rise ZIPs can use
        // substantial memory when opened with JSZip, so do not inspect or unpack
        // the archive before the HTTP response has been returned to the browser.
        const pkg = await ScormPackage.create({
            hostId: req.userId,
            title: String(title || 'Uploaded package').slice(0, 200),
            status: 'processing',
            source: 'upload',
            byteSize: zipBuf.length,
            analysisJson: null
        });

        const storage = getObjectStorage();
        const zipKey = packageZipKey(pkg.id);
        await storage.putObject({
            key: zipKey,
            body: zipBuf,
            contentType: 'application/zip'
        });
        pkg.storageKeyZip = zipKey;
        await pkg.save();

        const processInline =
            process.env.SCORM_PROCESS_INLINE === '1' ||
            process.env.NODE_ENV === 'test' ||
            process.env.REPORTS_PROCESS_INLINE === '1';

        let jobId = null;
        if (processInline) {
            try {
                await unpackPackage(pkg.id);
            } catch (e) {
                logger.error('scorm_inline_unpack_failed', { module: 'scorm', error: e.message });
            }
            await pkg.reload();
            return res.status(201).json({
                packageId: pkg.id,
                status: pkg.status,
                jobId,
                entryHref: pkg.entryHref,
                errorMessage: pkg.errorMessage,
                source: pkg.source
            });
        }

        if (usesDedicatedScormWorker()) {
            try {
                const job = await enqueueDedicatedUnpack(pkg, req.userId);
                jobId = job.id;
            } catch (e) {
                logger.warn('scorm_unpack_job_enqueue_failed', {
                    module: 'scorm',
                    packageId: pkg.id,
                    error: e.message
                });
            }
        } else {
            scheduleBackgroundUnpack(pkg.id);
        }

        return res.status(201).json({
            packageId: pkg.id,
            status: 'processing',
            jobId,
            entryHref: null,
            errorMessage: null,
            source: 'upload'
        });
    } catch (err) {
        logger.error('scorm_upload_failed', { module: 'scorm', error: err.message });
        res.status(500).json({ message: err.message });
    }
});

router.post('/upload-json', auth, async (req, res) => {
    try {
        const { zipBase64, title } = req.body || {};
        if (!zipBase64) return res.status(400).json({ message: 'zipBase64 required' });
        const zipBuf = Buffer.from(zipBase64, 'base64');
        const max = scormMaxUploadMb() * 1024 * 1024;
        if (zipBuf.length > max) return res.status(413).json({ message: `Max upload ${scormMaxUploadMb()} MB` });

        const aiAnalysis = await tryExtractAiAnalysis(zipBuf);
        const pkg = await ScormPackage.create({
            hostId: req.userId,
            title: (title || (aiAnalysis && aiAnalysis.title) || 'Uploaded package').slice(0, 200),
            status: 'processing',
            source: aiAnalysis ? 'ai_author' : 'upload',
            byteSize: zipBuf.length,
            analysisJson: aiAnalysis ? JSON.stringify(aiAnalysis) : null
        });
        const storage = getObjectStorage();
        const zipKey = packageZipKey(pkg.id);
        await storage.putObject({ key: zipKey, body: zipBuf, contentType: 'application/zip' });
        pkg.storageKeyZip = zipKey;
        await pkg.save();

        try {
            await unpackPackage(pkg.id);
        } catch (e) {
            /* status failed on package */
        }
        await pkg.reload();
        res.status(201).json({
            packageId: pkg.id,
            status: pkg.status,
            entryHref: pkg.entryHref,
            standard: pkg.standard,
            errorMessage: pkg.errorMessage,
            source: pkg.source
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/:id/reprocess', auth, async (req, res) => {
    try {
        const pkg = await ScormPackage.findOne({
            where: { id: req.params.id, hostId: req.userId }
        });
        if (!pkg || pkg.status === 'deleted') {
            return res.status(404).json({ message: 'Not found' });
        }
        if (!pkg.storageKeyZip) {
            return res.status(409).json({ message: 'Stored ZIP is missing' });
        }

        pkg.status = 'processing';
        pkg.errorMessage = null;
        await pkg.save();

        let jobId = null;
        if (usesDedicatedScormWorker()) {
            const job = await enqueueDedicatedUnpack(pkg, req.userId, `retry-${Date.now()}`);
            jobId = job.id;
        } else {
            scheduleBackgroundUnpack(pkg.id);
        }

        return res.status(202).json({
            ok: true,
            packageId: pkg.id,
            status: 'processing',
            jobId
        });
    } catch (err) {
        logger.error('scorm_reprocess_failed', {
            module: 'scorm',
            packageId: req.params.id,
            error: err.message
        });
        return res.status(500).json({ message: err.message });
    }
});

router.get('/', auth, async (req, res) => {
    const list = await ScormPackage.findAll({
        where: { hostId: req.userId },
        // Inventory views only need compact package metadata. analysisJson can
        // contain the complete authored course (including every slide, quiz and
        // visual reference), so selecting it here sends the same large payload
        // from Postgres on every dashboard/library refresh. Editors retrieve the
        // full document explicitly through /:id/analysis instead.
        attributes: [
            'id',
            'hostId',
            'title',
            'description',
            'standard',
            'storageKeyZip',
            'entryHref',
            'byteSize',
            'fileCount',
            'status',
            'source',
            'templateId',
            'errorMessage',
            'createdAt',
            'updatedAt'
        ],
        order: [['createdAt', 'DESC']]
    });
    res.json(list.filter((p) => p.status !== 'deleted'));
});

router.get('/:id/download-link', auth, async (req, res) => {
    try {
        const pkg = await ScormPackage.findOne({ where: { id: req.params.id, hostId: req.userId } });
        if (!pkg || pkg.status === 'deleted') return res.status(404).json({ message: 'Not found' });
        const safeName = `${String(pkg.title || 'trackable-package').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80)}.zip`;
        const storage = getObjectStorage();
        if (!pkg.storageKeyZip && pkg.source === 'video_course') {
            if (!(await prepareDirectUpload(storage))) {
                return res.status(503).json({ message: 'This video course download is temporarily unavailable.' });
            }
            let analysis = {};
            try { analysis = JSON.parse(String(pkg.analysisJson || '{}')); } catch (_) {}
            const extensionByType = {
                'video/mp4': 'mp4',
                'video/webm': 'webm',
                'video/ogg': 'ogv',
                'video/quicktime': 'mov'
            };
            const mediaPath = String(analysis.mediaPath || `media/course-video.${extensionByType[analysis.mimeType] || 'mp4'}`);
            if (!/^media\/course-video\.(mp4|webm|ogv|mov)$/i.test(mediaPath)) {
                return res.status(500).json({ message: 'The video course download metadata is invalid.' });
            }
            const definitions = [
                ['index.html', 'text/html; charset=utf-8'],
                ['scorm_api_wrapper.js', 'application/javascript'],
                ['imsmanifest.xml', 'application/xml'],
                [mediaPath, analysis.mimeType || 'application/octet-stream']
            ];
            const files = await Promise.all(definitions.map(async ([filePath, contentType]) => ({
                path: filePath,
                contentType,
                url: await signedReadUrl(storage, packageContentKey(pkg.id, filePath), { expiresIn: 15 * 60, contentType })
            })));
            if (files.some((file) => !file.url)) {
                return res.status(503).json({ message: 'This video course download is temporarily unavailable.' });
            }
            res.setHeader('Cache-Control', 'private, no-store');
            return res.json({ direct: false, clientBundle: true, downloadName: safeName, files });
        }
        if (!pkg.storageKeyZip) return res.status(404).json({ message: 'ZIP not stored' });
        const url = await signedReadUrl(storage, pkg.storageKeyZip, {
            expiresIn: 15 * 60,
            contentType: 'application/zip',
            downloadName: safeName
        });
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ direct: Boolean(url), url: url || null, downloadName: safeName });
    } catch (err) {
        res.status(500).json({ message: 'Unable to prepare the package download.' });
    }
});

router.get('/:id/download', auth, async (req, res) => {
    try {
        const pkg = await ScormPackage.findOne({ where: { id: req.params.id, hostId: req.userId } });
        if (!pkg || pkg.status === 'deleted') return res.status(404).json({ message: 'Not found' });
        if (!pkg.storageKeyZip) return res.status(404).json({ message: 'ZIP not stored' });

        const storage = getObjectStorage();
        const directName = `${String(pkg.title || 'trackable-package')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .slice(0, 80)}.zip`;
        if (await redirectToSignedObject(res, storage, pkg.storageKeyZip, {
            expiresIn: 15 * 60,
            contentType: 'application/zip',
            downloadName: directName,
            statusCode: 302
        })) return;
        const object = await storage.getObjectStream(pkg.storageKeyZip);
        const safeName = String(pkg.title || 'scorm-package')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .slice(0, 80);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
        if (Number.isFinite(Number(object.contentLength))) {
            res.setHeader('Content-Length', Number(object.contentLength));
        }
        object.stream.once('error', (error) => {
            logger.error('scorm_package_download_stream_failed', { module: 'scorm', packageId: pkg.id, error: error.message });
            if (!res.headersSent) res.status(500).json({ message: 'Package download failed' });
            else res.destroy(error);
        });
        object.stream.pipe(res);
    } catch (err) {
        logger.error('scorm_package_download_failed', { module: 'scorm', error: err.message });
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id/analysis', auth, async (req, res) => {
    try {
        const pkg = await ScormPackage.findOne({ where: { id: req.params.id, hostId: req.userId } });
        if (!pkg || pkg.status === 'deleted') return res.status(404).json({ message: 'Not found' });

        let analysis = null;
        if (pkg.analysisJson) {
            try {
                analysis = JSON.parse(pkg.analysisJson);
            } catch (_) {}
        }

        if (!analysis && pkg.storageKeyZip) {
            try {
                const JSZip = require('jszip');
                const storage = getObjectStorage();
                const buf = await storage.getObjectBuffer(pkg.storageKeyZip);
                const zip = await JSZip.loadAsync(buf);
                const entry = zip.file('content.json');
                if (entry) {
                    analysis = JSON.parse(await entry.async('string'));
                    pkg.analysisJson = JSON.stringify(analysis);
                    if (pkg.source === 'upload') pkg.source = 'ai_author';
                    await pkg.save();
                }
            } catch (e) {
                logger.warn('scorm_analysis_from_zip_failed', { module: 'scorm', error: e.message });
            }
        }

        if (!analysis) {
            return res.status(404).json({
                message: 'No editable analysis for this package (only AI-authored packages with content.json can be edited)'
            });
        }

        res.json({
            ok: true,
            packageId: pkg.id,
            title: pkg.title,
            source: pkg.source,
            templateId: pkg.templateId,
            analysis
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', auth, async (req, res) => {
    const pkg = await ScormPackage.findOne({ where: { id: req.params.id, hostId: req.userId } });
    if (!pkg || pkg.status === 'deleted') return res.status(404).json({ message: 'Not found' });
    res.json(pkg);
});

router.delete('/:id', auth, async (req, res) => {
    const pkg = await ScormPackage.findOne({ where: { id: req.params.id, hostId: req.userId } });
    if (!pkg) return res.status(404).json({ message: 'Not found' });

    pkg.status = 'deleted';
    await pkg.save();

    try {
        await ScormCourse.update(
            { status: 'archived' },
            { where: { packageId: pkg.id, hostId: req.userId } }
        );
    } catch (e) {
        logger.warn('scorm_package_delete_archive_courses', { module: 'scorm', error: e.message });
    }

    let storageResult = { deleted: 0 };
    try {
        storageResult = await deletePackageFromStorage(pkg.id, pkg.storageKeyZip);
    } catch (e) {
        logger.error('scorm_package_storage_cleanup_failed', {
            module: 'scorm',
            packageId: pkg.id,
            error: e.message
        });
    }

    try {
        await JobQueueService.enqueue({
            type: JOB_TYPES.SCORM_PACKAGE_DELETE,
            payload: { packageId: pkg.id },
            idempotencyKey: `scorm-delete:${pkg.id}`
        });
    } catch (_) {}

    res.json({
        ok: true,
        archivedCourses: true,
        storageDeleted: storageResult.deleted || 0
    });
});

module.exports = router;
