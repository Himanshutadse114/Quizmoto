const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const router = express.Router();
const auth = require('../middleware');
const { ScormPackage } = require('../../models/scorm');
const { assertActiveCourseCapacity } = require('../../services/scorm/ScormAiUsageService');
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
