const express = require('express');
const rateLimit = require('express-rate-limit');
const { featureFlags } = require('../config/featureFlags');
const router = express.Router();
const {
    getWorkspaceAndConfig,
    serializeAuthConfig,
    createLearnerSession,
    learnerAuthMiddleware,
    getLearnerDashboard,
    launchLearnerCourse
} = require('../services/scorm/ScormLearnerAuthService');

const learnerAuthLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: {
        message: 'Too many learner sign-in attempts. Please wait a few minutes and try again.',
        code: 'SCORM_LEARNER_RATE_LIMITED'
    }
});

router.use((req, res, next) => {
    if (!featureFlags.scormLms) {
        return res.status(404).json({ message: 'LMSGEN learner portal is not enabled.' });
    }
    next();
});

// Campaign delivery is the preferred organisation flow. It is mounted under
// the learner API so campaign SSO shares the same public feature gate/CORS
// surface as the existing workspace learner portal.
router.use('/campaign', require('./scormCampaignLearner'));

router.get('/workspace/:workspaceId/config', async (req, res) => {
    try {
        const { workspace, config } = await getWorkspaceAndConfig(req.params.workspaceId);
        res.json({
            ok: true,
            config: serializeAuthConfig(config, { workspace, publicView: true })
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load learner portal.', code: err.code });
    }
});

router.post('/workspace/:workspaceId/email', learnerAuthLimiter, async (req, res) => {
    try {
        const result = await createLearnerSession({
            workspaceId: req.params.workspaceId,
            provider: 'email',
            email: req.body?.email,
            name: req.body?.name
        });
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Learner sign-in failed.', code: err.code });
    }
});

router.post('/workspace/:workspaceId/google', learnerAuthLimiter, async (req, res) => {
    try {
        const result = await createLearnerSession({
            workspaceId: req.params.workspaceId,
            provider: 'google',
            credential: req.body?.credential
        });
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Google learner sign-in failed.', code: err.code });
    }
});

router.post('/workspace/:workspaceId/microsoft', learnerAuthLimiter, async (req, res) => {
    try {
        const result = await createLearnerSession({
            workspaceId: req.params.workspaceId,
            provider: 'microsoft',
            credential: req.body?.idToken || req.body?.credential
        });
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Microsoft learner sign-in failed.', code: err.code });
    }
});

router.get('/dashboard', learnerAuthMiddleware, async (req, res) => {
    try {
        res.json(await getLearnerDashboard(req.scormLearner));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load learner dashboard.', code: err.code });
    }
});

router.post('/courses/:registrationId/launch', learnerAuthMiddleware, async (req, res) => {
    try {
        res.json(await launchLearnerCourse(req.scormLearner, req.params.registrationId));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to launch this course.', code: err.code });
    }
});

module.exports = router;
