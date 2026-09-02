const { Op, fn, col, literal } = require('sequelize');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormCampaignCourse,
    ScormRegistration
} = require('../../models/scorm');
const {
    normalizeStoredAuthMode,
    authModeLabel
} = require('./ScormCampaignAuthPolicy');

const ACTIVE_REGISTRATION_STATUSES = { [Op.notIn]: ['revoked', 'superseded'] };

function countMap(rows, field = 'count') {
    const map = new Map();
    for (const row of rows || []) map.set(String(row.campaignId), Number(row[field] || 0));
    return map;
}

async function groupedCount(Model, campaignIds) {
    if (!campaignIds.length) return [];
    return Model.findAll({
        attributes: ['campaignId', [fn('COUNT', col('id')), 'count']],
        where: { campaignId: { [Op.in]: campaignIds } },
        group: ['campaignId'],
        raw: true
    });
}

async function registrationSummaries(campaignIds) {
    if (!campaignIds.length) return [];
    return ScormRegistration.findAll({
        attributes: [
            'campaignId',
            [fn('COUNT', col('id')), 'assignmentCount'],
            [literal(`SUM(CASE
                WHEN "status" = 'completed'
                  OR LOWER(COALESCE("lastLessonStatus", '')) IN ('completed', 'passed', 'failed')
                THEN 1 ELSE 0 END)`), 'completedCount'],
            [literal(`SUM(CASE
                WHEN NOT (
                    "status" = 'completed'
                    OR LOWER(COALESCE("lastLessonStatus", '')) IN ('completed', 'passed', 'failed')
                )
                AND ("status" IN ('active', 'in_progress') OR "lastCommitAt" IS NOT NULL)
                THEN 1 ELSE 0 END)`), 'inProgressCount']
        ],
        where: {
            campaignId: { [Op.in]: campaignIds },
            isPreview: false,
            status: ACTIVE_REGISTRATION_STATUSES
        },
        group: ['campaignId'],
        raw: true
    });
}

async function listCampaigns({ hostId, workspaceId }) {
    // The Campaigns route is now a pure list workspace. Course-selection and
    // SSO configuration are loaded only by /campaigns/create-options when the
    // administrator opens the dedicated Create Campaign page.
    const campaigns = await ScormCampaign.findAll({
        where: { hostId, workspaceId },
        attributes: ['id', 'name', 'status', 'authMode', 'dueAt', 'required', 'createdAt', 'startedAt'],
        order: [['createdAt', 'DESC']],
        raw: true
    });

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const [learnerRows, courseRows, summaryRows] = campaignIds.length
        ? await Promise.all([
            groupedCount(ScormCampaignLearner, campaignIds),
            groupedCount(ScormCampaignCourse, campaignIds),
            registrationSummaries(campaignIds)
        ])
        : [[], [], []];

    const learnerCounts = countMap(learnerRows);
    const courseCounts = countMap(courseRows);
    const summaries = new Map((summaryRows || []).map((row) => [String(row.campaignId), {
        assignmentCount: Number(row.assignmentCount || 0),
        completedCount: Number(row.completedCount || 0),
        inProgressCount: Number(row.inProgressCount || 0)
    }]));

    return {
        campaigns: campaigns.map((campaign) => {
            const summary = summaries.get(String(campaign.id)) || { assignmentCount: 0, completedCount: 0, inProgressCount: 0 };
            const mode = normalizeStoredAuthMode(campaign.authMode);
            return {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                authMode: mode,
                authModeLabel: authModeLabel(mode),
                dueAt: campaign.dueAt || null,
                required: campaign.required !== false,
                createdAt: campaign.createdAt,
                startedAt: campaign.startedAt || null,
                learnerCount: learnerCounts.get(String(campaign.id)) || 0,
                courseCount: courseCounts.get(String(campaign.id)) || 0,
                assignmentCount: summary.assignmentCount,
                completedCount: summary.completedCount,
                inProgressCount: summary.inProgressCount,
                completionPercent: summary.assignmentCount ? Math.round((summary.completedCount / summary.assignmentCount) * 100) : 0,
                portalPath: campaign.status === 'active' ? `/campaign/${campaign.id}` : null
            };
        })
    };
}

module.exports = {
    listCampaigns,
    registrationSummaries
};
