const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const router = express.Router();
const auth = require('../middleware');
const { ScormPackage } = require('../../models/scorm');
const { assertActiveCourseCapacity } = require('../../services/scorm/ScormAiUsageService');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { isDirectUploadEnabled, prepareDirectUpload } = require('../../storage/DirectObjectDelivery');
const {
    acceptedVideoType,
    videoExtension,
    createVideoCourse,
    readAnalysis
} = require('../../services/scorm/ScormVideoCourseService');

const MAX_VIDEO_MB = Math.max(25, Math.min(1000, Number(process.env.SCORM_MAX_VIDEO_MB || 250)));
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

function decodeMetadata(req) {
    try {
        const encoded = String(req.headers['x-video-course-metadata'] || '');
        if (!encoded) return {};
        const value = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        return value && typeof value === 'object' ? value : {};
    } catch (_) {
        return {};
    }
}

function contentLength(req) {
    const value = Number(req.headers['content-length']);
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function validByteSize(value) {
    const bytes = Number(value);
    return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_VIDEO_BYTES ? bytes : 0;
}

function cleanMetadata(value = {}) {
    const input = value && typeof value === 'object' ? value : {};
    return {
        title: String(input.title || input.fileName || 'Video course').replace(/\.[^.]+$/, '').trim().slice(0, 200) || 'Video course',
        description: String(input.description || '').trim().slice(0, 1200) || null,
        durationSeconds: Math.max(0, Number(input.durationSeconds || 0)) || null,
        fileName: String(input.fileName || '').slice(0, 255)
    };
}

function directVideoPrefix(userId) {
    return `direct-uploads/video-courses/${String(userId || 'unknown')}/`;
}

function byteLimiter(maxBytes) {
    let bytes = 0;
    const stream = new Transform({
        transform(chunk, encoding, callback) {
            bytes += chunk.length;
            if (bytes > maxBytes) {
                const error = new Error(`Video exceeds the ${MAX_VIDEO_MB} MB upload limit.`);
                error.status = 413;
                error.code = 'VIDEO_COURSE_TOO_LARGE';
                callback(error);
                return;
            }
            callback(null, chunk);
        }
    });
    stream.bytesReceived = () => bytes;
    return stream;
}

router.get('/config', auth, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, maxUploadMb: MAX_VIDEO_MB, acceptedMimeTypes: Object.keys(require('../../services/scorm/ScormVideoCourseService').VIDEO_TYPES) });
});

router.post('/upload-ticket', auth, async (req, res) => {
    try {
        const mimeType = acceptedVideoType(req.body?.mimeType);
        const byteSize = validByteSize(req.body?.byteSize);
        if (!mimeType) return res.status(415).json({ message: 'Upload an MP4, WebM, OGG or MOV video.' });
        if (!byteSize) return res.status(413).json({ message: `Video must be between 1 byte and ${MAX_VIDEO_MB} MB.` });
        const replacePackageId = String(req.body?.replacePackageId || '').trim();
        if (!replacePackageId) await assertActiveCourseCapacity(req.userId, req.scormEntitlement);
        const storage = getObjectStorage();
        if (!(await prepareDirectUpload(storage))) return res.json({ direct: false });
        const sourceKey = `${directVideoPrefix(req.userId)}${crypto.randomUUID()}.${videoExtension(mimeType)}`;
        const uploadUrl = await storage.createSignedPutUrl(sourceKey, { expiresIn: 15 * 60, contentType: mimeType });
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({
            direct: true,
            uploadUrl,
            sourceKey,
            mimeType,
            byteSize,
            metadata: cleanMetadata(req.body?.metadata),
            headers: { 'Content-Type': mimeType },
            expiresIn: 15 * 60
        });
    } catch (error) {
        res.status(Number(error.status) || 500).json({ message: error.message || 'Unable to prepare video upload.', code: error.code });
    }
});

router.post('/upload-complete', auth, async (req, res) => {
    let tempDir = null;
    const storage = getObjectStorage();
    const sourceKey = String(req.body?.sourceKey || '');
    try {
        if (!isDirectUploadEnabled(storage)) return res.status(409).json({ message: 'Direct video upload is unavailable.' });
        if (!sourceKey.startsWith(directVideoPrefix(req.userId)) || !/^[a-zA-Z0-9/_\-.]+$/.test(sourceKey)) {
            return res.status(400).json({ message: 'Invalid video upload reference.' });
        }
        const mimeType = acceptedVideoType(req.body?.mimeType);
        const byteSize = validByteSize(req.body?.byteSize);
        if (!mimeType || !byteSize) return res.status(400).json({ message: 'Invalid video upload metadata.' });
        const replacePackageId = String(req.body?.replacePackageId || '').trim();
        if (!replacePackageId) await assertActiveCourseCapacity(req.userId, req.scormEntitlement);
        const head = await storage.headObject(sourceKey);
        if (Number(head.contentLength) !== byteSize) return res.status(400).json({ message: 'The complete video did not arrive. Please retry the upload.' });
        const metadata = cleanMetadata(req.body?.metadata);
        tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lmsgen-video-course-direct-'));
        const sourcePath = path.join(tempDir, `source.${videoExtension(mimeType)}`);
        const object = await storage.getObjectStream(sourceKey);
        await pipeline(object.stream, fs.createWriteStream(sourcePath));
        const created = await createVideoCourse({
            hostId: req.userId,
            title: metadata.title,
            description: metadata.description,
            mimeType,
            durationSeconds: metadata.durationSeconds,
            sourcePath,
            sourceStorageKey: sourceKey,
            tempDir,
            replacePackageId
        });
        res.status(replacePackageId ? 200 : 201).json({
            ok: true,
            courseId: created.course.id,
            packageId: created.package.id,
            title: created.course.title,
            status: created.course.status,
            source: created.package.source,
            standard: created.package.standard,
            byteSize: Number(created.package.byteSize || 0),
            downloadPath: `/api/scorm/packages/${created.package.id}/download`,
            replaced: Boolean(replacePackageId)
        });
    } catch (error) {
        const status = Number(error.status) || 500;
        res.status(status).json({
            message: status >= 500 ? 'The video course could not be created. Please retry.' : error.message,
            code: error.code || 'VIDEO_COURSE_CREATION_FAILED'
        });
    } finally {
        if (sourceKey.startsWith(directVideoPrefix(req.userId))) await storage.deleteObject(sourceKey).catch(() => {});
        if (tempDir) await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
});

router.get('/:packageId', auth, async (req, res) => {
    try {
        const pkg = await ScormPackage.findOne({ where: { id: req.params.packageId, hostId: req.userId } });
        if (!pkg || pkg.status === 'deleted' || pkg.source !== 'video_course') {
            return res.status(404).json({ message: 'Editable video course not found.' });
        }
        const analysis = readAnalysis(pkg.analysisJson);
        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            ok: true,
            packageId: pkg.id,
            title: pkg.title,
            description: pkg.description || '',
            status: pkg.status,
            mimeType: analysis.mimeType || '',
            durationSeconds: Number(analysis.durationSeconds) || null,
            revision: Math.max(1, Number(analysis.revision) || 1)
        });
    } catch (error) {
        return res.status(500).json({ message: 'The video course could not be loaded. Please retry.' });
    }
});

async function uploadVideoCourse(req, res, replacePackageId = '') {
    let tempDir = null;
    try {
        if (isDirectUploadEnabled(getObjectStorage())) {
            return res.status(409).json({
                message: 'Use the secure direct upload flow for this video.',
                code: 'DIRECT_UPLOAD_REQUIRED'
            });
        }
        const mimeType = acceptedVideoType(req.headers['content-type']);
        if (!mimeType) return res.status(415).json({ message: 'Upload an MP4, WebM, OGG or MOV video.' });
        const declaredBytes = contentLength(req);
        if (!declaredBytes) return res.status(411).json({ message: 'The selected video size could not be determined. Choose the file again and retry.' });
        if (declaredBytes > MAX_VIDEO_BYTES) return res.status(413).json({ message: `Video exceeds the ${MAX_VIDEO_MB} MB upload limit.` });

        if (!replacePackageId) await assertActiveCourseCapacity(req.userId, req.scormEntitlement);
        const metadata = decodeMetadata(req);
        const fallbackTitle = String(metadata.fileName || 'Video course').replace(/\.[^.]+$/, '');
        const title = String(metadata.title || fallbackTitle || 'Video course').trim().slice(0, 200) || 'Video course';
        const description = String(metadata.description || '').trim().slice(0, 1200) || null;
        const durationSeconds = Math.max(0, Number(metadata.durationSeconds || 0)) || null;

        tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lmsgen-video-course-'));
        const sourcePath = path.join(tempDir, `source.${videoExtension(mimeType)}`);
        const limiter = byteLimiter(MAX_VIDEO_BYTES);
        const aborted = () => {
            const error = new Error('The video upload was interrupted. Please retry.');
            error.status = 400;
            error.code = 'VIDEO_COURSE_UPLOAD_ABORTED';
            limiter.destroy(error);
        };
        req.once('aborted', aborted);
        await pipeline(req, limiter, fs.createWriteStream(sourcePath));
        req.removeListener('aborted', aborted);
        if (limiter.bytesReceived() !== declaredBytes) {
            const error = new Error('The complete video did not arrive. Please retry the upload.');
            error.status = 400;
            error.code = 'VIDEO_COURSE_UPLOAD_INCOMPLETE';
            throw error;
        }

        const created = await createVideoCourse({
            hostId: req.userId,
            title,
            description,
            mimeType,
            durationSeconds,
            sourcePath,
            tempDir,
            replacePackageId
        });
        res.status(replacePackageId ? 200 : 201).json({
            ok: true,
            courseId: created.course.id,
            packageId: created.package.id,
            title: created.course.title,
            status: created.course.status,
            source: created.package.source,
            standard: created.package.standard,
            byteSize: Number(created.package.byteSize || 0),
            downloadPath: `/api/scorm/packages/${created.package.id}/download`,
            replaced: Boolean(replacePackageId)
        });
    } catch (error) {
        const status = Number(error.status) || 500;
        res.status(status).json({
            message: status >= 500 ? `The video course could not be ${replacePackageId ? 'rebuilt' : 'created'}. Please retry.` : error.message,
            code: error.code || 'VIDEO_COURSE_CREATION_FAILED'
        });
    } finally {
        if (tempDir) await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

router.post('/', auth, (req, res) => uploadVideoCourse(req, res));
router.put('/:packageId', auth, (req, res) => uploadVideoCourse(req, res, String(req.params.packageId || '').trim()));

module.exports = router;
module.exports._test = { decodeMetadata, contentLength, byteLimiter, MAX_VIDEO_BYTES };
