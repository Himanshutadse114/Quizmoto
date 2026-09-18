const express = require('express');
const router = express.Router();
const { ScormVideo } = require('../models/scorm');
const { getObjectStorage } = require('../storage/ObjectStorage');
const { redirectToSignedObject } = require('../storage/DirectObjectDelivery');
const { authorizeVideoStream, ensureVideoSchema } = require('../services/scorm/ScormVideoService');

function parseRange(value, total) {
    const match = String(value || '').match(/^bytes=(\d+)-(\d*)$/i);
    if (!match) return null;
    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : Math.min(total - 1, start + (2 * 1024 * 1024) - 1);
    if (!Number.isFinite(start) || start < 0 || start >= total) return null;
    return { start, end: Math.min(total - 1, Math.max(start, requestedEnd)) };
}

router.get('/:videoId/stream', async (req, res) => {
    try {
        await ensureVideoSchema();
        await authorizeVideoStream(req.query.token, req.params.videoId);
        const video = await ScormVideo.findOne({ where: { id: req.params.videoId, status: 'ready' } });
        if (!video) return res.status(404).json({ message: 'Video not found.' });
        const storage = getObjectStorage();
        if (await redirectToSignedObject(res, storage, video.storageKey, {
            expiresIn: 4 * 60 * 60,
            contentType: video.mimeType || 'video/mp4'
        })) return;
        const total = Number(video.byteSize || 0);
        const range = total ? parseRange(req.headers.range, total) : null;
        const object = await storage.getObjectStream(video.storageKey, range || {});
        res.setHeader('Content-Type', video.mimeType || object.contentType || 'video/mp4');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'private, no-store');
        if (range) {
            res.status(206);
            res.setHeader('Content-Range', object.contentRange || `bytes ${range.start}-${range.end}/${total}`);
            res.setHeader('Content-Length', object.contentLength || (range.end - range.start + 1));
        } else if (object.contentLength) {
            res.setHeader('Content-Length', object.contentLength);
        }
        object.stream.on('error', () => { if (!res.headersSent) res.sendStatus(500); else res.destroy(); });
        object.stream.pipe(res);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Unable to stream video.', code: error.code });
    }
});

module.exports = router;
