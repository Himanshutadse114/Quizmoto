const express = require('express');
const router = express.Router();
const auth = require('../middleware');
const { ScormCampaign } = require('../../models/scorm');
const { createCampaign, startCampaign } = require('../../services/scorm/ScormCampaignService');
const { listCampaigns } = require('../../services/scorm/ScormCampaignListService');
const { getCampaignCreateOptions } = require('../../services/scorm/ScormCampaignCreateOptionsService');
const {
    listPublishedTenantFlipbooks,
    saveCampaignFlipbooks,
    campaignFlipbooks,
    createCampaignAssignments
} = require('../../services/scorm/ScormFlipbookAssignmentService');

function workspaceRequired(req) {
    if (!req.scormWorkspaceId) {
        const err = new Error('A workspace is required to manage campaigns.');
        err.status = 400;
        err.code = 'SCORM_WORKSPACE_REQUIRED';
        throw err;
    }
}

router.get('/create-options', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const [base, flipbooks] = await Promise.all([
            getCampaignCreateOptions({ hostId: req.userId, workspaceId: req.scormWorkspaceId }),
            listPublishedTenantFlipbooks({ hostId: req.userId, workspaceId: req.scormWorkspaceId })
        ]);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...base, flipbooks });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign creation options.', code: err.code });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await listCampaigns({ hostId: req.userId, workspaceId: req.scormWorkspaceId });
        const campaigns = [];
        for (const campaign of result.campaigns || []) {
            const flipbooks = await campaignFlipbooks(campaign.id);
            campaigns.push({
                ...campaign,
                flipbookCount: flipbooks.length,
                learningItemCount: Number(campaign.courseCount || 0) + flipbooks.length
            });
        }
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...result, campaigns });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaigns.', code: err.code });
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
        const campaign = await ScormCampaign.findOne({
            where: { id: result.campaign.id, hostId: req.userId, workspaceId: req.scormWorkspaceId }
        });
        const links = await saveCampaignFlipbooks({
            campaign,
            selections: req.body?.flipbookSelections || []
        });
        res.status(201).json({
            ok: true,
            ...result,
            campaign: {
                ...result.campaign,
                flipbookCount: links.length,
                learningItemCount: Number(result.campaign.courseCount || 0) + links.length
            },
            flipbooks: await campaignFlipbooks(campaign.id)
        });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to create campaign.', code: err.code });
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
        const flipbooks = await createCampaignAssignments({
            campaignId: req.params.campaignId,
            actorUserId: req.authenticatedUserId || req.userId
        });
        res.json({ ok: true, campaign, flipbookAssignmentsCreated: flipbooks.created });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to start campaign.', code: err.code });
    }
});

module.exports = router;
