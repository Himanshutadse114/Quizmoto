const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const auth = require('../middleware');
const { ScormCampaign, ScormVideoProgress } = require('../../models/scorm');
const ScormFlipbookAssignment = require('../../models/scorm/ScormFlipbookAssignment');
const { createCampaign, startCampaign } = require('../../services/scorm/ScormCampaignService');
const { deleteCampaign } = require('../../services/scorm/ScormCampaignLifecycleService');
const { listCampaigns } = require('../../services/scorm/ScormCampaignListService');
const { getCampaignCreateOptions } = require('../../services/scorm/ScormCampaignCreateOptionsService');
const { getCampaignSummaryDetail } = require('../../services/scorm/ScormCampaignReadService');
const {
    listPublishedTenantFlipbooks,
    saveCampaignFlipbooks,
    campaignFlipbooks,
    createCampaignAssignments,
    ensureFlipbookAssignmentSchema
} = require('../../services/scorm/ScormFlipbookAssignmentService');
const {
    listVideos,
    saveCampaignVideos,
    campaignVideos,
    ensureVideoSchema
} = require('../../services/scorm/ScormVideoService');

function workspaceRequired(req) {
    if (!req.scormWorkspaceId) {
        const err = new Error('A workspace is required to manage campaigns.');
        err.status = 400;
        err.code = 'SCORM_WORKSPACE_REQUIRED';
        throw err;
    }
}

router.param('campaignId', (req, res, next, value) => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))) return next();
    return res.status(404).json({ message: 'Campaign not found.', code: 'SCORM_CAMPAIGN_NOT_FOUND' });
});

function combinedCompletion(campaign, flipbookCount, videoCount, flipbookAssignments, videoProgress) {
    const externalItems = Number(flipbookCount || 0) + Number(videoCount || 0);
    const externalAssignmentCount = campaign.status === 'active'
        ? Number(campaign.learnerCount || 0) * externalItems
        : 0;
    const externalCompletedCount = (flipbookAssignments || []).filter((row) => row.status === 'completed').length
        + (videoProgress || []).filter((row) => row.status === 'completed').length;
    const externalInProgressCount = (flipbookAssignments || []).filter((row) => row.status === 'in_progress').length
        + (videoProgress || []).filter((row) => row.status === 'in_progress').length;
    const assignmentCount = Number(campaign.assignmentCount || 0) + externalAssignmentCount;
    const completedCount = Number(campaign.completedCount || 0) + externalCompletedCount;
    return {
        courseAssignmentCount: Number(campaign.assignmentCount || 0),
        assignmentCount,
        completedCount,
        inProgressCount: Number(campaign.inProgressCount || 0) + externalInProgressCount,
        scormCompletionPercent: Number(campaign.completionPercent || 0),
        completionPercent: assignmentCount ? Math.round((completedCount / assignmentCount) * 100) : 0
    };
}

router.get('/create-options', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const [base, flipbooks, videos] = await Promise.all([
            getCampaignCreateOptions({ hostId: req.userId, workspaceId: req.scormWorkspaceId }),
            listPublishedTenantFlipbooks({ hostId: req.userId, workspaceId: req.scormWorkspaceId }),
            listVideos({ hostId: req.userId, workspaceId: req.scormWorkspaceId })
        ]);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...base, flipbooks, videos });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign creation options.', code: err.code });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const result = await listCampaigns({ hostId: req.userId, workspaceId: req.scormWorkspaceId });
        await Promise.all([ensureFlipbookAssignmentSchema(), ensureVideoSchema()]);
        const campaignIds = (result.campaigns || []).map((campaign) => campaign.id);
        const [allFlipbookAssignments, allVideoProgress] = campaignIds.length ? await Promise.all([
            ScormFlipbookAssignment.findAll({
                where: { campaignId: { [Op.in]: campaignIds }, status: { [Op.ne]: 'revoked' } },
                attributes: ['campaignId', 'status'],
                raw: true
            }),
            ScormVideoProgress.findAll({
                where: { campaignId: { [Op.in]: campaignIds } },
                attributes: ['campaignId', 'status'],
                raw: true
            })
        ]) : [[], []];
        const campaigns = [];
        for (const campaign of result.campaigns || []) {
            const [flipbooks, videos] = await Promise.all([campaignFlipbooks(campaign.id), campaignVideos(campaign.id)]);
            const progress = combinedCompletion(
                campaign,
                flipbooks.length,
                videos.length,
                allFlipbookAssignments.filter((row) => String(row.campaignId) === String(campaign.id)),
                allVideoProgress.filter((row) => String(row.campaignId) === String(campaign.id))
            );
            campaigns.push({
                ...campaign,
                ...progress,
                flipbookCount: flipbooks.length,
                videoCount: videos.length,
                learningItemCount: Number(campaign.courseCount || 0) + flipbooks.length + videos.length
            });
        }
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, ...result, campaigns });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaigns.', code: err.code });
    }
});

router.post('/', auth, async (req, res) => {
    let createdCampaignId = null;
    try {
        workspaceRequired(req);
        const flipbookIds = new Set((Array.isArray(req.body?.flipbookSelections) ? req.body.flipbookSelections : [])
            .map((item) => String(typeof item === 'string' ? item : item?.flipbookId || '').trim()).filter(Boolean));
        const videoIds = new Set((Array.isArray(req.body?.videoSelections) ? req.body.videoSelections : [])
            .map((item) => String(typeof item === 'string' ? item : item?.videoId || '').trim()).filter(Boolean));
        const additionalLearningItemCount = flipbookIds.size + videoIds.size;
        const result = await createCampaign({
            workspaceId: req.scormWorkspaceId,
            hostId: req.userId,
            actorUserId: req.authenticatedUserId || req.userId,
            name: req.body?.name,
            csvText: req.body?.csvText,
            courseIds: req.body?.courseIds,
            dueAt: req.body?.dueAt,
            required: req.body?.required !== false,
            authMode: req.body?.authMode,
            mailBatchCount: req.body?.mailBatchCount,
            mailBatchDelaySeconds: req.body?.mailBatchDelaySeconds,
            additionalLearningItemCount
        });
        createdCampaignId = result.campaign.id;
        const campaign = await ScormCampaign.findOne({
            where: { id: result.campaign.id, hostId: req.userId, workspaceId: req.scormWorkspaceId }
        });
        if (!campaign) throw Object.assign(new Error('Campaign could not be loaded after creation.'), { status: 500, code: 'SCORM_CAMPAIGN_CREATE_INCOMPLETE' });
        // Save sequentially so a failed selection cannot race campaign cleanup
        // and leave an orphaned link after Promise.all has already rejected.
        const links = await saveCampaignFlipbooks({ campaign, selections: req.body?.flipbookSelections || [] });
        const videoLinks = await saveCampaignVideos({ campaign, selections: req.body?.videoSelections || [] });
        res.status(201).json({
            ok: true,
            ...result,
            campaign: {
                ...result.campaign,
                flipbookCount: links.length,
                videoCount: videoLinks.length,
                learningItemCount: Number(result.campaign.courseCount || 0) + links.length + videoLinks.length
            },
            flipbooks: await campaignFlipbooks(campaign.id),
            videos: await campaignVideos(campaign.id)
        });
    } catch (err) {
        if (createdCampaignId) {
            await deleteCampaign({ campaignId: createdCampaignId, hostId: req.userId, workspaceId: req.scormWorkspaceId }).catch(() => {});
        }
        res.status(err.status || 500).json({ message: err.message || 'Unable to create campaign.', code: err.code });
    }
});

router.post('/:campaignId/start', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        const ownedCampaign = await ScormCampaign.findOne({
            where: { id: req.params.campaignId, hostId: req.userId, workspaceId: req.scormWorkspaceId }
        });
        if (!ownedCampaign) return res.status(404).json({ message: 'Campaign not found.', code: 'SCORM_CAMPAIGN_NOT_FOUND' });
        const [flipbookLinks, videos] = await Promise.all([
            campaignFlipbooks(req.params.campaignId),
            campaignVideos(req.params.campaignId)
        ]);
        const flipbookAssignments = await createCampaignAssignments({
            campaignId: req.params.campaignId,
            actorUserId: req.authenticatedUserId || req.userId
        });
        const campaign = await startCampaign({
            campaignId: req.params.campaignId,
            hostId: req.userId,
            workspaceId: req.scormWorkspaceId,
            actorUserId: req.authenticatedUserId || req.userId,
            additionalLearningItemCount: flipbookLinks.length + videos.length
        });
        res.json({ ok: true, campaign, flipbookAssignmentsCreated: flipbookAssignments.created, videoAssignmentsReady: videos.length });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to start campaign.', code: err.code });
    }
});

router.get('/:campaignId/summary', auth, async (req, res) => {
    try {
        workspaceRequired(req);
        await Promise.all([ensureFlipbookAssignmentSchema(), ensureVideoSchema()]);
        const [campaign, flipbooks, videos, flipbookAssignments, videoProgress] = await Promise.all([
            getCampaignSummaryDetail({ campaignId: req.params.campaignId, hostId: req.userId, workspaceId: req.scormWorkspaceId }),
            campaignFlipbooks(req.params.campaignId),
            campaignVideos(req.params.campaignId),
            ScormFlipbookAssignment.findAll({
                where: { campaignId: req.params.campaignId, status: { [Op.ne]: 'revoked' } },
                attributes: ['status'],
                raw: true
            }),
            ScormVideoProgress.findAll({
                where: { campaignId: req.params.campaignId },
                attributes: ['status'],
                raw: true
            })
        ]);
        const progress = combinedCompletion(campaign, flipbooks.length, videos.length, flipbookAssignments, videoProgress);
        res.setHeader('Cache-Control', 'no-store');
        res.json({ ok: true, campaign: { ...campaign, ...progress, flipbooks, videos, flipbookCount: flipbooks.length, videoCount: videos.length, learningItemCount: Number(campaign.courseCount || 0) + flipbooks.length + videos.length } });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || 'Unable to load campaign summary.', code: err.code });
    }
});

module.exports = router;
