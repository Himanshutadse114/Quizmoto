const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { ScormPackage } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageZipKey } = require('../../services/scorm/storageKeys');
const { scormMaxUploadMb } = require('../../config/featureFlags');
const JobQueueService = require('../../jobs/JobQueueService');
const { JOB_TYPES } = require('../../jobs/jobTypes');
const { unpackPackage } = require('../../services/scorm/ScormUnpackService');
const logger = require('../../utils/logger');

router.post('/upload', auth, express.raw({ type: ['application/zip', 'application/octet-stream'], limit: '50mb' }), async (req, res) => {
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

        const pkg = await ScormPackage.create({
            hostId: req.userId,
            title: String(title).slice(0, 200),
            status: 'processing',
            source: 'upload',
            byteSize: zipBuf.length
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
        } else {
            const job = await JobQueueService.enqueue({
                type: JOB_TYPES.SCORM_VALIDATE_UNPACK,
                payload: { packageId: pkg.id, hostId: req.userId },
                idempotencyKey: `scorm-unpack:${pkg.id}`
            });
            jobId = job.id;
            setImmediate(() => {
                unpackPackage(pkg.id).catch((err) => {
                    logger.error('scorm_bg_unpack_failed', { module: 'scorm', error: err.message });
                });
            });
        }

        await pkg.reload();
        res.status(201).json({
            packageId: pkg.id,
            status: pkg.status,
            jobId,
            entryHref: pkg.entryHref,
            errorMessage: pkg.errorMessage
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

        const pkg = await ScormPackage.create({
            hostId: req.userId,
            title: (title || 'Uploaded package').slice(0, 200),
            status: 'processing',
            source: 'upload',
            byteSize: zipBuf.length
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
            errorMessage: pkg.errorMessage
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/', auth, async (req, res) => {
    const list = await ScormPackage.findAll({
        where: { hostId: req.userId },
        order: [['createdAt', 'DESC']]
    });
    res.json(list.filter((p) => p.status !== 'deleted'));
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
        await JobQueueService.enqueue({
            type: JOB_TYPES.SCORM_PACKAGE_DELETE,
            payload: { packageId: pkg.id }
        });
    } catch (_) { /* ignore */ }
    res.json({ ok: true });
});

module.exports = router;
