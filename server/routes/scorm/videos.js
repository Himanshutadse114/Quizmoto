const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { ScormVideo, ScormCampaignVideo, ScormVideoProgress } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { ensureVideoSchema, listVideos, launchAdminVideo } = require('../../services/scorm/ScormVideoService');

const MAX_VIDEO_MB = Math.max(25, Math.min(1000, Number(process.env.SCORM_MAX_VIDEO_MB || 250)));
const ACCEPTED = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
const parseVideoBody = express.raw({ type: ['video/*', 'application/octet-stream'], limit: `${MAX_VIDEO_MB}mb` });

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

router.get('/', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, videos: await listVideos({ workspaceId: req.scormWorkspaceId, hostId: req.userId }), maxUploadMb: MAX_VIDEO_MB });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Unable to load videos.' });
    }
});

router.post('/upload', auth, (req, res, next) => {
    parseVideoBody(req, res, (error) => {
        if (error?.type === 'entity.too.large') {
            return res.status(413).json({ message: `Video exceeds the ${MAX_VIDEO_MB} MB upload limit.` });
        }
        if (error) return next(error);
        next();
    });
}, async (req, res) => {
    let video = null;
    try {
        workspaceRequired(req);
        const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!ACCEPTED.has(mimeType)) return res.status(415).json({ message: 'Upload an MP4, WebM, OGG or MOV video.' });
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Video file is required.' });
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
            byteSize: req.body.length,
            durationSeconds,
            status: 'processing'
        });
        video.storageKey = `videos/${video.id}/source.${safeExtension(mimeType)}`;
        await getObjectStorage().putObject({ key: video.storageKey, body: req.body, contentType: mimeType });
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
