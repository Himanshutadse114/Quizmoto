const express = require('express');
const { Transform } = require('stream');
const router = express.Router();
const auth = require('../middleware');
const { ScormVideo, ScormCampaignVideo, ScormVideoProgress } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { isDirectUploadEnabled, prepareDirectUpload } = require('../../storage/DirectObjectDelivery');
const { ensureVideoSchema, listVideos, launchAdminVideo } = require('../../services/scorm/ScormVideoService');

const MAX_VIDEO_MB = Math.max(25, Math.min(1000, Number(process.env.SCORM_MAX_VIDEO_MB || 250)));
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
const ACCEPTED = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);

function workspaceRequired(req) {
    if (req.scormWorkspaceId) return;
    const error = new Error('A workspace is required to manage videos.');
    error.status = 400;
    throw error;
}

function safeExtension(mimeType) {
    if (mimeType === 'video/webm') return 'webm';
    if (mimeType === 'video/ogg') return 'ogv';
    if (mimeType === 'video/quicktime') return 'mov';
    return 'mp4';
}

function uploadMetadata(req) {
    try {
        const encoded = String(req.headers['x-video-metadata'] || '');
        if (!encoded) return {};
        const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

function declaredContentLength(req) {
    const value = Number(req.headers['content-length']);
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function limitUploadStream(source, maxBytes) {
    let bytes = 0;
    const limiter = new Transform({
        transform(chunk, encoding, callback) {
            bytes += chunk.length;
            if (bytes > maxBytes) {
                const error = new Error(`Video exceeds the ${MAX_VIDEO_MB} MB upload limit.`);
                error.status = 413;
                error.code = 'VIDEO_TOO_LARGE';
                callback(error);
                return;
            }
            callback(null, chunk);
        }
    });
    limiter.bytesReceived = () => bytes;
    source.once('error', (error) => limiter.destroy(error));
    source.once('aborted', () => {
        const error = new Error('The video upload was interrupted. Please retry.');
        error.status = 400;
        error.code = 'VIDEO_UPLOAD_ABORTED';
        limiter.destroy(error);
    });
    source.pipe(limiter);
    return limiter;
}

router.get('/', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, videos: await listVideos({ workspaceId: req.scormWorkspaceId, hostId: req.userId }), maxUploadMb: MAX_VIDEO_MB });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Unable to load videos.' });
    }
});

router.post('/upload-ticket', auth, async (req, res) => {
    let video = null;
    try {
        workspaceRequired(req);
        const mimeType = String(req.body?.mimeType || '').split(';')[0].trim().toLowerCase();
        const contentLength = Number(req.body?.byteSize || 0);
        if (!ACCEPTED.has(mimeType)) return res.status(415).json({ message: 'Upload an MP4, WebM, OGG or MOV video.' });
        if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_VIDEO_BYTES) {
            return res.status(413).json({ message: `Video must be between 1 byte and ${MAX_VIDEO_MB} MB.` });
        }
        const storage = getObjectStorage();
        if (!(await prepareDirectUpload(storage))) return res.json({ direct: false });
        await ensureVideoSchema();
        const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
        const title = String(metadata.title || 'Untitled video').trim().slice(0, 200) || 'Untitled video';
        const description = String(metadata.description || '').trim().slice(0, 1200) || null;
        const durationSeconds = Math.max(0, Number(metadata.durationSeconds || 0)) || null;
        video = await ScormVideo.create({
            workspaceId: req.scormWorkspaceId,
            hostId: req.userId,
            ownerUserId: req.authenticatedUserId || req.userId,
            title,
            description,
            storageKey: `videos/pending-${Date.now()}`,
            mimeType,
            byteSize: contentLength,
            durationSeconds,
            status: 'processing'
        });
        video.storageKey = `videos/${video.id}/source.${safeExtension(mimeType)}`;
        await video.save();
        const uploadUrl = await storage.createSignedPutUrl(video.storageKey, { expiresIn: 15 * 60, contentType: mimeType });
        res.setHeader('Cache-Control', 'private, no-store');
        res.status(201).json({
            direct: true,
            uploadUrl,
            videoId: video.id,
            mimeType,
            byteSize: contentLength,
            headers: { 'Content-Type': mimeType },
            expiresIn: 15 * 60
        });
    } catch (error) {
        if (video) {
            video.status = 'failed';
            await video.save().catch(() => {});
        }
        res.status(error.status || 500).json({ message: error.message || 'Unable to prepare video upload.' });
    }
});

router.post('/:videoId/upload-complete', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        await ensureVideoSchema();
        const video = await ScormVideo.findOne({ where: { id: req.params.videoId, workspaceId: req.scormWorkspaceId, hostId: req.userId, status: 'processing' } });
        if (!video) return res.status(404).json({ message: 'Pending video upload not found.' });
        const storage = getObjectStorage();
        if (!isDirectUploadEnabled(storage)) return res.status(409).json({ message: 'Direct video upload is unavailable.' });
        const head = await storage.headObject(video.storageKey);
        if (Number(head.contentLength) !== Number(video.byteSize)) {
            await storage.deleteObject(video.storageKey).catch(() => {});
            video.status = 'failed';
            await video.save();
            return res.status(400).json({ message: 'The video upload was incomplete. Please retry.' });
        }
        video.status = 'ready';
        await video.save();
        res.status(201).json({
            ok: true,
            video: {
                id: video.id,
                title: video.title,
                description: video.description,
                mimeType: video.mimeType,
                byteSize: Number(video.byteSize),
                durationSeconds: video.durationSeconds == null ? null : Number(video.durationSeconds),
                status: video.status,
                createdAt: video.createdAt
            }
        });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Unable to confirm video upload.' });
    }
});

router.post('/upload', auth, async (req, res) => {
    let video = null;
    try {
        workspaceRequired(req);
        if (isDirectUploadEnabled(getObjectStorage())) {
            return res.status(409).json({
                message: 'Use the secure direct upload flow for this video.',
                code: 'DIRECT_UPLOAD_REQUIRED'
            });
        }
        const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!ACCEPTED.has(mimeType)) return res.status(415).json({ message: 'Upload an MP4, WebM, OGG or MOV video.' });
        const contentLength = declaredContentLength(req);
        if (!contentLength) return res.status(411).json({ message: 'The video file size could not be determined. Please choose the file again.' });
        if (contentLength > MAX_VIDEO_BYTES) return res.status(413).json({ message: `Video exceeds the ${MAX_VIDEO_MB} MB upload limit.` });
        await ensureVideoSchema();
        const metadata = uploadMetadata(req);
        const title = String(metadata.title || req.query.title || req.headers['x-video-title'] || 'Untitled video').trim().slice(0, 200) || 'Untitled video';
        const description = String(metadata.description || req.query.description || '').trim().slice(0, 1200) || null;
        const durationSeconds = Math.max(0, Number(metadata.durationSeconds || req.query.durationSeconds || 0)) || null;
        video = await ScormVideo.create({
            workspaceId: req.scormWorkspaceId,
            hostId: req.userId,
            ownerUserId: req.authenticatedUserId || req.userId,
            title,
            description,
            storageKey: `videos/pending-${Date.now()}`,
            mimeType,
            byteSize: contentLength,
            durationSeconds,
            status: 'processing'
        });
        video.storageKey = `videos/${video.id}/source.${safeExtension(mimeType)}`;
        const uploadStream = limitUploadStream(req, MAX_VIDEO_BYTES);
        const stored = await getObjectStorage().putObjectStream({
            key: video.storageKey,
            stream: uploadStream,
            contentType: mimeType,
            contentLength
        });
        if (Number(stored.size) !== contentLength || uploadStream.bytesReceived() !== contentLength) {
            const error = new Error('The video upload was interrupted before the complete file arrived. Please retry.');
            error.status = 400;
            error.code = 'INCOMPLETE_VIDEO_UPLOAD';
            throw error;
        }
        video.byteSize = stored.size;
        video.status = 'ready';
        await video.save();
        res.status(201).json({ ok: true, video: { id: video.id, title: video.title, description: video.description, mimeType, byteSize: Number(video.byteSize), durationSeconds, status: video.status, createdAt: video.createdAt } });
    } catch (error) {
        if (video) {
            video.status = 'failed';
            await video.save().catch(() => {});
            if (!String(video.storageKey || '').includes('pending-')) {
                await getObjectStorage().deleteObject(video.storageKey).catch(() => {});
            }
        }
        res.status(error.status || 500).json({ message: error.message || 'Video upload failed.' });
    }
});

router.post('/:videoId/preview', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        res.json({ ok: true, ...(await launchAdminVideo({ workspaceId: req.scormWorkspaceId, hostId: req.userId }, req.params.videoId)) });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Unable to preview video.', code: error.code });
    }
});

router.delete('/:videoId', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        await ensureVideoSchema();
        const video = await ScormVideo.findOne({ where: { id: req.params.videoId, workspaceId: req.scormWorkspaceId, hostId: req.userId, status: { [require('sequelize').Op.ne]: 'deleted' } } });
        if (!video) return res.status(404).json({ message: 'Video not found.' });
        const assigned = await ScormCampaignVideo.count({ where: { videoId: video.id } });
        if (assigned) return res.status(409).json({ message: 'Remove this video from its campaigns before deleting it.' });
        video.status = 'deleted';
        await video.save();
        await ScormVideoProgress.destroy({ where: { videoId: video.id } });
        await getObjectStorage().deleteObject(video.storageKey).catch(() => {});
        res.json({ ok: true, removed: true });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Unable to delete video.' });
    }
});

module.exports = router;
module.exports._test = { declaredContentLength, limitUploadStream, MAX_VIDEO_BYTES };
