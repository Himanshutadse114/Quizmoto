const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    parseCampaignCsv,
    createCampaign,
    getCampaignDetail,
    getCampaignAccessSheet,
    startCampaign
} = require('../../services/scorm/ScormCampaignService');
const {
    getCampaignSummaryDetail,
    getCampaignManageDetail
} = require('../../services/scorm/ScormCampaignReadService');
const {
    stopCampaign,
    deleteCampaign
} = require('../../services/scorm/ScormCampaignLifecycleService');
const { listCampaigns } = require('../../services/scorm/ScormCampaignListService');
const { getCampaignCreateOptions } = require('../../services/scorm/ScormCampaignCreateOptionsService');
const { getCampaignAnalytics } = require('../../services/scorm/ScormCampaignAnalyticsService');
const {
    addLearners,
    removeLearner,
    sendReminders
} = require('../../services/scorm/ScormCampaignMemberService');

function workspaceRequired(req) {
    if (!req.scormWorkspaceId) {
        const err = new Error('A workspace is required to manage campaigns.');
        err.status = 400;
        err.code = 'SCORM_WORKSPACE_REQUIRED';
        throw err;
    }
}

router.get('/', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await listCampaigns({ hostId: req.userId, workspaceId: req.scormWorkspaceId });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaigns.', code: err.code });
    }
});

router.get('/create-options', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await getCampaignCreateOptions({
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign creation options.', code: err.code });
    }
});

router.post('/preview-csv', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const parsed = parseCampaignCsv(req.body?.csvText);
        res.json({
            ok: true,
            validLearners: parsed.learners.length,
            totalRows: parsed.totalRows,
            invalidRows: parsed.invalidRows,
            learners: parsed.learners.slice(0, 100)
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to read CSV.', code: err.code });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await createCampaign({
            workspaceId: req.scormWorkspaceId,
            hostId: req.userId,
            actorUserId: req.authenticatedUserId || req.userId,
            name: req.body?.name,
            csvText: req.body?.csvText,
            courseIds: req.body?.courseIds,
            dueAt: req.body?.dueAt,
            required: req.body?.required !== false,
            authMode: req.body?.authMode
        });
        res.status(201).json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to create campaign.', code: err.code });
    }
});

router.get('/:campaignId/analytics', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const analytics = await getCampaignAnalytics({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...analytics });
    } catch (err) {
        console.error('[scorm-campaign-analytics] load failed', {
            campaignId: req.params.campaignId,
            message: err?.message,
            code: err?.code
        });
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign analytics.', code: err.code });
    }
});

router.get('/:campaignId/access-sheet', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await getCampaignAccessSheet({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to prepare learner access codes.', code: err.code });
    }
});

// Lightweight read models used by the admin UI. These deliberately avoid
// returning every learner-course registration when the screen only needs
// campaign metadata or one compact status per learner.
router.get('/:campaignId/summary', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const campaign = await getCampaignSummaryDetail({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, campaign });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign summary.', code: err.code });
    }
});

router.get('/:campaignId/manage', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const campaign = await getCampaignManageDetail({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, campaign });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign learners.', code: err.code });
    }
});

router.post('/:campaignId/learners', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await addLearners({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId,
            actorUserId: req.authenticatedUserId || req.userId,
            learners: req.body?.learners
        });
        res.status(201).json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to add campaign learners.', code: err.code });
    }
});

router.delete('/:campaignId/learners/:email', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await removeLearner({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId,
            email: req.params.email
        });
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to remove campaign learner.', code: err.code });
    }
});

router.post('/:campaignId/reminders', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await sendReminders({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId,
            emails: req.body?.emails
        });
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to send campaign reminders.', code: err.code });
    }
});

// Retain the original full-detail endpoint for backwards compatibility and
// internal consumers that genuinely need every learner-course registration.
router.get('/:campaignId', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const campaign = await getCampaignDetail({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, campaign });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign.', code: err.code });
    }
});

router.post('/:campaignId/start', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const campaign = await startCampaign({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId,
            actorUserId: req.authenticatedUserId || req.userId
        });
        res.json({ ok: true, campaign });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to start campaign.', code: err.code });
    }
});

router.post('/:campaignId/stop', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await stopCampaign({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to stop campaign.', code: err.code });
    }
});

router.delete('/:campaignId', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        res.json({
            ok: true,
            ...(await deleteCampaign({
                campaignId: req.params.campaignId,
                hostId: req.userId,
                workspaceId: req.scormWorkspaceId
            }))
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to delete campaign.', code: err.code });
    }
});

module.exports = router;
