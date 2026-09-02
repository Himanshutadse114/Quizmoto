const { Op, fn, col, literal } = require('sequelize');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormCampaignCourse,
    ScormCourse,
    ScormRegistration,
    ScormWorkspaceAuthConfig
} = require('../../models/scorm');
const {
    normalizeStoredAuthMode,
    authModeLabel
} = require('./ScormCampaignAuthPolicy');

const ACTIVE_REGISTRATION_STATUSES = { [Op.notIn]: ['revoked', 'superseded'] };

function authOptions(config) {
    return {
        emailCode: true,
        googleConfigured: Boolean(config?.googleEnabled && config?.googleClientId),
        microsoftConfigured: Boolean(config?.microsoftEnabled && config?.microsoftClientId && config?.microsoftTenantId)
    };
}

function countMap(rows, field = 'count') {
    const map = new Map();
    for (const row of rows || []) {
        map.set(String(row.campaignId), Number(row[field] || 0));
    }
    return map;
}

async function groupedCount(Model, campaignIds) {
    if (!campaignIds.length) return [];
    return Model.findAll({
        attributes: [
            'campaignId',
            [fn('COUNT', col('id')), 'count']
        ],
        where: { campaignId: { [Op.in]: campaignIds } },
        group: ['campaignId'],
        raw: true
    });
}

async function registrationSummaries(campaignIds) {
    if (!campaignIds.length) return [];

    // The campaign list only needs summary numbers. Loading every registration
    // and then every canonical SCORM state made this endpoint grow linearly with
    // learner-course combinations. Let PostgreSQL aggregate the denormalised
    // registration projection instead; exact canonical progress remains in the
    // dedicated Campaign Analytics flow.
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
    const [campaigns, courses, authConfig] = await Promise.all([
        ScormCampaign.findAll({
            where: { hostId, workspaceId },
            attributes: ['id', 'name', 'status', 'authMode', 'dueAt', 'required', 'createdAt', 'startedAt'],
            order: [['createdAt', 'DESC']],
            raw: true
        }),
        // Campaign creation only accepts published courses, so there is no reason
        // to transfer archived/draft course metadata on every Campaigns visit.
        ScormCourse.findAll({
            where: { hostId, status: 'published' },
            attributes: ['id', 'title', 'status', 'publishedAt'],
            order: [['createdAt', 'DESC']],
            raw: true
        }),
        ScormWorkspaceAuthConfig.findOne({
            where: { workspaceId },
            attributes: ['googleEnabled', 'googleClientId', 'microsoftEnabled', 'microsoftClientId', 'microsoftTenantId'],
            raw: true
        })
    ]);

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
            const summary = summaries.get(String(campaign.id)) || {
                assignmentCount: 0,
                completedCount: 0,
                inProgressCount: 0
            };
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
                completionPercent: summary.assignmentCount
                    ? Math.round((summary.completedCount / summary.assignmentCount) * 100)
                    : 0,
                portalPath: campaign.status === 'active' ? `/campaign/${campaign.id}` : null
            };
        }),
        authOptions: authOptions(authConfig),
        courses: courses.map((course) => ({
            id: course.id,
            title: course.title,
            status: course.status,
            publishedAt: course.publishedAt || null
        }))
    };
}

module.exports = {
    listCampaigns,
    authOptions,
    registrationSummaries
};
