const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { ScormPackage, ScormCourse } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('../../services/scorm/storageKeys');
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

router.post('/upload', auth, express.raw({
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
        order: [['createdAt', 'DESC']]
    });
    res.json(list.filter((p) => p.status !== 'deleted'));
});

router.get('/:id/download', auth, async (req, res) => {
    try {
        const pkg = await ScormPackage.findOne({ where: { id: req.params.id, hostId: req.userId } });
        if (!pkg || pkg.status === 'deleted') return res.status(404).json({ message: 'Not found' });
        if (!pkg.storageKeyZip) return res.status(404).json({ message: 'ZIP not stored' });

        const storage = getObjectStorage();
        const buf = await storage.getObjectBuffer(pkg.storageKeyZip);
        const safeName = String(pkg.title || 'scorm-package')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .slice(0, 80);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
        res.setHeader('Content-Length', buf.length);
        res.send(buf);
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
