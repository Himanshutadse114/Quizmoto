const express = require('express');
const rateLimit = require('express-rate-limit');
const { featureFlags } = require('../config/featureFlags');
const router = express.Router();
const {
    getPublicCampaign,
    campaignAuthMiddleware,
    createCampaignSession,
    launchCampaignCourse
} = require('../services/scorm/ScormCampaignService');
const { getCampaignDashboard } = require('../services/scorm/ScormLearnerProgressFacade');

const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: {
        message: 'Too many campaign sign-in attempts. Please wait a few minutes and try again.',
        code: 'SCORM_CAMPAIGN_RATE_LIMITED'
    }
});

router.use((req, res, next) => {
    if (!featureFlags.scormLms) return res.status(404).json({ message: 'LMSGEN learner campaigns are not enabled.' });
    next();
});

router.get('/:campaignId/config', async (req, res) => {
    try {
        const { publicConfig } = await getPublicCampaign(req.params.campaignId);
        res.json({ ok: true, config: publicConfig });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign.', code: err.code });
    }
});

router.post('/:campaignId/email-code', authLimiter, async (req, res) => {
    try {
        res.json(await createCampaignSession({
            campaignId: req.params.campaignId,
            provider: 'email_code',
            email: req.body?.email,
            name: req.body?.name,
            accessCode: req.body?.accessCode
        }));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Campaign sign-in failed.', code: err.code });
    }
});

router.post('/:campaignId/google', authLimiter, async (req, res) => {
    try {
        res.json(await createCampaignSession({
            campaignId: req.params.campaignId,
            provider: 'google',
            credential: req.body?.credential
        }));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Google campaign sign-in failed.', code: err.code });
    }
});

router.post('/:campaignId/microsoft', authLimiter, async (req, res) => {
    try {
        res.json(await createCampaignSession({
            campaignId: req.params.campaignId,
            provider: 'microsoft',
            credential: req.body?.idToken || req.body?.credential
        }));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Microsoft campaign sign-in failed.', code: err.code });
    }
});

router.get('/session/dashboard', campaignAuthMiddleware, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json(await getCampaignDashboard(req.scormCampaignLearner));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign dashboard.', code: err.code });
    }
});

router.post('/session/courses/:registrationId/launch', campaignAuthMiddleware, async (req, res) => {
    try {
        res.json(await launchCampaignCourse(req.scormCampaignLearner, req.params.registrationId));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to launch this course.', code: err.code });
    }
});

module.exports = router;
