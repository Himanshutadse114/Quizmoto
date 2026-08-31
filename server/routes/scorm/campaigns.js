const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const {
    parseCampaignCsv,
    listCampaigns,
    createCampaign,
    getCampaignDetail,
    startCampaign,
    deleteDraftCampaign
} = require('../../services/scorm/ScormCampaignService');
const { getCampaignAnalytics } = require('../../services/scorm/ScormCampaignAnalyticsService');

function workspaceRequired(req) {
    if (!req.scormWorkspaceId) {
        const err = new Error('A workspace is required to manage campaigns.');
        err.status = 400;
        err.code = 'SCORM_WORKSPACE_REQUIRED';
        throw err;
    }
}

function universalPortal(campaign) {
    if (!campaign) return campaign;
    return {
        ...campaign,
        portalPath: campaign.status === 'active' ? '/learn' : null
    };
}

router.get('/', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await listCampaigns({ hostId: req.userId, workspaceId: req.scormWorkspaceId });
        res.json({
            ok: true,
            ...result,
            campaigns: (result.campaigns || []).map(universalPortal)
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaigns.', code: err.code });
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
            required: req.body?.required !== false
        });
        res.status(201).json({ ok: true, ...result, campaign: universalPortal(result.campaign) });
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

router.get('/:campaignId', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const campaign = await getCampaignDetail({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId
        });
        res.json({ ok: true, campaign: universalPortal(campaign) });
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
        res.json({ ok: true, campaign: universalPortal(campaign) });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to start campaign.', code: err.code });
    }
});

router.delete('/:campaignId', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        res.json({
            ok: true,
            ...(await deleteDraftCampaign({
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
