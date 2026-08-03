/**
 * Phase 3 job status / download API.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('./middleware');
const JobQueueService = require('../jobs/JobQueueService');
const { JOB_STATUS } = require('../jobs/jobTypes');

const router = express.Router();

router.get('/:id', auth, async (req, res) => {
    try {
        const job = await JobQueueService.getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // Owner-only: actorId stored as host user id string
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
                hasArtifact: !!job.result.artifactPath
            };
            if (job.result.artifactPath) {
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
        if (job.status !== JOB_STATUS.COMPLETED || !job.result || !job.result.artifactPath) {
            return res.status(409).json({ message: 'Artifact not ready' });
        }

        const filePath = job.result.artifactPath;
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Artifact file missing' });
        }

        const downloadName = job.result.downloadName || path.basename(filePath);
        res.download(filePath, downloadName);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
