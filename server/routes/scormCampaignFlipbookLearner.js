const express = require('express');
const router = express.Router();
const { campaignAuthMiddleware } = require('../services/scorm/ScormCampaignService');
const { getCampaignDashboard } = require('../services/scorm/ScormLearnerProgressFacade');
const {
    getCampaignDashboardFlipbooks,
    launchCampaignFlipbook
} = require('../services/scorm/ScormFlipbookAssignmentService');

router.get('/session/dashboard', campaignAuthMiddleware, async (req, res) => {
    try {
        const [dashboard, flipbooks] = await Promise.all([
            getCampaignDashboard(req.scormCampaignLearner),
            getCampaignDashboardFlipbooks(req.scormCampaignLearner)
        ]);
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            ...dashboard,
            flipbooks,
            learningSummary: {
                courses: Array.isArray(dashboard.courses) ? dashboard.courses.length : 0,
                flipbooks: flipbooks.length,
                totalItems: (Array.isArray(dashboard.courses) ? dashboard.courses.length : 0) + flipbooks.length
            }
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign dashboard.', code: err.code });
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
        res.status(err.status || 500).json({ message: err.message || 'Unable to launch this Flipbook.', code: err.code });
    }
});

module.exports = router;
