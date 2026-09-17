const express = require('express');
const rateLimit = require('express-rate-limit');
const { featureFlags } = require('../config/featureFlags');
const router = express.Router();
const {
    getWorkspaceAndConfig,
    serializeAuthConfig,
    createLearnerSession,
    createLearnerSessionFromIdentity,
    verifyGlobalGoogleCredential,
    learnerAuthMiddleware,
    launchLearnerCourse
} = require('../services/scorm/ScormLearnerAuthService');
const { getLearnerDashboard } = require('../services/scorm/ScormLearnerProgressFacade');
const { enrichDashboardCourses } = require('../services/scorm/ScormCanonicalProgressService');
const { discoverLearnerPolicy } = require('../services/scorm/ScormLearnerDiscoveryService');
const { launchCampaignFlipbook } = require('../services/scorm/ScormFlipbookAssignmentService');
const { launchCampaignVideo, recordVideoProgress } = require('../services/scorm/ScormVideoService');

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

router.use('/video', require('./scormVideoLearner'));

// Add Flipbook learning items to campaign dashboards and launch handling before
// the existing course-only campaign router consumes those exact paths.
router.use('/campaign', require('./scormCampaignFlipbookLearner'));
router.use('/campaign', require('./scormCampaignLearner'));

router.post('/discover', learnerAuthLimiter, async (req, res) => {
    try {
        const result = await discoverLearnerPolicy(req.body?.email);
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            ok: true,
            workspaceId: result.workspace.id,
            workspaceName: result.workspace.name,
            discoverySource: result.source,
            config: result.publicConfig
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to identify your learning organisation.', code: err.code });
    }
});

router.post('/google', learnerAuthLimiter, async (req, res) => {
    try {
        const identity = await verifyGlobalGoogleCredential(req.body?.credential);
        const policy = await discoverLearnerPolicy(identity.email);
        const result = await createLearnerSessionFromIdentity({ workspaceId: policy.workspace.id, identity });
        res.setHeader('Cache-Control', 'no-store');
        res.json(await enrichDashboardCourses(result));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Google learner sign-in failed.', code: err.code });
    }
});

router.get('/workspace/:workspaceId/config', async (req, res) => {
    try {
        const { workspace, config } = await getWorkspaceAndConfig(req.params.workspaceId);
        res.json({ ok: true, config: serializeAuthConfig(config, { workspace, publicView: true }) });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load learner portal.', code: err.code });
    }
});

router.post('/workspace/:workspaceId/email', learnerAuthLimiter, async (req, res) => {
    try {
        const result = await createLearnerSession({ workspaceId: req.params.workspaceId, provider: 'email', email: req.body?.email, name: req.body?.name });
        res.setHeader('Cache-Control', 'no-store');
        res.json(await enrichDashboardCourses(result));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Learner sign-in failed.', code: err.code });
    }
});

router.post('/workspace/:workspaceId/google', learnerAuthLimiter, async (req, res) => {
    try {
        const result = await createLearnerSession({ workspaceId: req.params.workspaceId, provider: 'google', credential: req.body?.credential });
        res.setHeader('Cache-Control', 'no-store');
        res.json(await enrichDashboardCourses(result));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Google learner sign-in failed.', code: err.code });
    }
});

router.post('/workspace/:workspaceId/microsoft', learnerAuthLimiter, async (req, res) => {
    try {
        const result = await createLearnerSession({ workspaceId: req.params.workspaceId, provider: 'microsoft', credential: req.body?.idToken || req.body?.credential });
        res.setHeader('Cache-Control', 'no-store');
        res.json(await enrichDashboardCourses(result));
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Microsoft learner sign-in failed.', code: err.code });
    }
});

router.get('/dashboard', learnerAuthMiddleware, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
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

router.post('/campaigns/:campaignId/flipbooks/:assignmentId/launch', learnerAuthMiddleware, async (req, res) => {
    try {
        const result = await launchCampaignFlipbook({ ...req.scormLearner, campaignId: req.params.campaignId }, req.params.assignmentId);
        const url = new URL(result.url);
        const assignmentToken = url.searchParams.get('assignment');
        if (assignmentToken) { url.searchParams.delete('assignment'); url.searchParams.set('source', `assignment:${assignmentToken}`); }
        res.json({ ...result, url: url.toString() });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to launch this publication.', code: err.code });
    }
});

router.post('/campaigns/:campaignId/videos/:videoId/launch', learnerAuthMiddleware, async (req, res) => {
    try {
        res.json({ ok: true, ...(await launchCampaignVideo({ ...req.scormLearner, campaignId: req.params.campaignId }, req.params.videoId)) });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to launch this video.', code: err.code });
    }
});

router.post('/campaigns/:campaignId/videos/:videoId/progress', learnerAuthMiddleware, express.json({ limit: '64kb' }), async (req, res) => {
    try {
        res.json({ ok: true, progress: await recordVideoProgress({ ...req.scormLearner, campaignId: req.params.campaignId }, req.params.videoId, req.body || {}) });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to save video progress.', code: err.code });
    }
});

module.exports = router;
