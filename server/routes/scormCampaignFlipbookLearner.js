const express = require('express');
const router = express.Router();
const { campaignAuthMiddleware } = require('../services/scorm/ScormCampaignService');
const { getCampaignDashboard } = require('../services/scorm/ScormLearnerProgressFacade');
const {
    getCampaignDashboardFlipbooks,
    launchCampaignFlipbook
} = require('../services/scorm/ScormFlipbookAssignmentService');
const {
    getCampaignDashboardVideos,
    launchCampaignVideo,
    recordVideoProgress
} = require('../services/scorm/ScormVideoService');

router.get('/session/dashboard', campaignAuthMiddleware, async (req, res) => {
    try {
        const [dashboard, flipbooks, videos] = await Promise.all([
            getCampaignDashboard(req.scormCampaignLearner),
            getCampaignDashboardFlipbooks(req.scormCampaignLearner),
            getCampaignDashboardVideos(req.scormCampaignLearner)
        ]);
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            ...dashboard,
            flipbooks,
            videos,
            learningSummary: {
                courses: Array.isArray(dashboard.courses) ? dashboard.courses.length : 0,
                flipbooks: flipbooks.length,
                videos: videos.length,
                totalItems: (Array.isArray(dashboard.courses) ? dashboard.courses.length : 0) + flipbooks.length + videos.length
            }
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign dashboard.', code: err.code });
    }
});

router.post('/session/videos/:videoId/launch', campaignAuthMiddleware, async (req, res) => {
    try {
        res.json({ ok: true, ...(await launchCampaignVideo(req.scormCampaignLearner, req.params.videoId)) });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to launch this video.', code: err.code });
    }
});

router.post('/session/videos/:videoId/progress', campaignAuthMiddleware, express.json({ limit: '64kb' }), async (req, res) => {
    try {
        res.json({ ok: true, progress: await recordVideoProgress(req.scormCampaignLearner, req.params.videoId, req.body || {}) });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to save video progress.', code: err.code });
    }
});

router.post('/session/flipbooks/:assignmentId/launch', campaignAuthMiddleware, async (req, res) => {
    try {
        const result = await launchCampaignFlipbook(req.scormCampaignLearner, req.params.assignmentId);
        // Encode the assignment token inside source because the public React
        // Flipbook wrapper already preserves and forwards the source parameter.
        const url = new URL(result.url);
        const assignmentToken = url.searchParams.get('assignment');
        if (assignmentToken) {
            url.searchParams.delete('assignment');
            url.searchParams.set('source', `assignment:${assignmentToken}`);
        }
        res.json({ ...result, url: url.toString() });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to launch this publication.', code: err.code });
    }
});

module.exports = router;
