/**
 * Phase 3 job status / download API.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('./middleware');
const JobQueueService = require('../jobs/JobQueueService');
const { JOB_STATUS } = require('../jobs/jobTypes');
const { getObjectStorage } = require('../storage/ObjectStorage');

const router = express.Router();

router.get('/:id', auth, async (req, res) => {
    try {
        const job = await JobQueueService.getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        if (job.actorId && String(job.actorId) !== String(req.userId)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const body = {
            id: job.id,
            type: job.type,
            status: job.status,
            error: job.error,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            finishedAt: job.finishedAt
        };

        if (job.status === JOB_STATUS.COMPLETED && job.result) {
            body.result = {
                ok: job.result.ok,
                sessionId: job.result.sessionId,
                format: job.result.format,
                downloadName: job.result.downloadName,
                storageKey: job.result.storageKey || null,
                hasArtifact: !!(job.result.storageKey || job.result.artifactPath)
            };
            if (job.result.storageKey || job.result.artifactPath) {
                body.downloadPath = `/api/jobs/${job.id}/download`;
            }
        }

        res.json(body);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id/download', auth, async (req, res) => {
    try {
        const job = await JobQueueService.getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }
        if (job.actorId && String(job.actorId) !== String(req.userId)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        if (job.status !== JOB_STATUS.COMPLETED || !job.result) {
            return res.status(409).json({ message: 'Artifact not ready' });
        }

        const downloadName = job.result.downloadName || 'Report.bin';
        const contentType = job.result.contentType || 'application/octet-stream';

        // Prefer object storage key
        if (job.result.storageKey) {
            const storage = getObjectStorage();
            try {
                const obj = await storage.getObjectStream(job.result.storageKey);
                res.setHeader('Content-Type', obj.contentType || contentType);
                if (obj.contentLength != null) {
                    res.setHeader('Content-Length', obj.contentLength);
                }
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${downloadName}"`
                );
                obj.stream.pipe(res);
                return;
            } catch (err) {
                if (err.code !== 'OBJECT_NOT_FOUND') {
                    console.error(err);
                    return res.status(500).json({ message: 'Storage read failed' });
                }
                // fall through to legacy local path
            }
        }

        const filePath = job.result.artifactPath;
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Artifact file missing' });
        }

        res.download(filePath, downloadName);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
