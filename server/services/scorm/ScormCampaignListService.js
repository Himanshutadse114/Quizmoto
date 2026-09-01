const { Op, fn, col } = require('sequelize');
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
const {
    registrationProgress,
    loadCanonicalStates
} = require('./ScormCanonicalProgressService');

const ACTIVE_REGISTRATION_STATUSES = { [Op.notIn]: ['revoked', 'superseded'] };

function authOptions(config) {
    return {
        emailCode: true,
        googleConfigured: Boolean(config?.googleEnabled && config?.googleClientId),
        microsoftConfigured: Boolean(config?.microsoftEnabled && config?.microsoftClientId && config?.microsoftTenantId)
    };
}

function registrationStatus(registration, state = null) {
    return registrationProgress(registration, state).status;
}

function countMap(rows) {
    const map = new Map();
    for (const row of rows || []) {
        map.set(String(row.campaignId), Number(row.count || 0));
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

async function listCampaigns({ hostId, workspaceId }) {
    const [campaigns, courses, authConfig] = await Promise.all([
        ScormCampaign.findAll({
            where: { hostId, workspaceId },
            attributes: ['id', 'name', 'status', 'authMode', 'dueAt', 'required', 'createdAt', 'startedAt'],
            order: [['createdAt', 'DESC']],
            raw: true
        }),
        ScormCourse.findAll({
            where: { hostId, status: { [Op.ne]: 'archived' } },
            attributes: ['id', 'title', 'description', 'status', 'publishedAt', 'createdAt'],
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
    const [learnerRows, courseRows, registrations] = campaignIds.length
        ? await Promise.all([
            groupedCount(ScormCampaignLearner, campaignIds),
            groupedCount(ScormCampaignCourse, campaignIds),
            ScormRegistration.findAll({
                where: {
                    campaignId: { [Op.in]: campaignIds },
                    isPreview: false,
                    status: ACTIVE_REGISTRATION_STATUSES
                },
                attributes: ['id', 'campaignId', 'status', 'lastLessonStatus', 'lastScoreRaw', 'lastTotalTime', 'lastCommitAt'],
                raw: true
            })
        ])
        : [[], [], []];

    // The learner player persists to scorm_learning_state_v2 first. Registration
    // summary columns are only a denormalized projection and may lag or fail to
    // project. Campaign summaries therefore read the canonical state directly.
    const canonicalStates = await loadCanonicalStates(registrations);

    const learnerCounts = countMap(learnerRows);
    const courseCounts = countMap(courseRows);
    const registrationBuckets = new Map();
    for (const registration of registrations) {
        const key = String(registration.campaignId);
        if (!registrationBuckets.has(key)) registrationBuckets.set(key, []);
        registrationBuckets.get(key).push(registration);
    }

    return {
        campaigns: campaigns.map((campaign) => {
            const rows = registrationBuckets.get(String(campaign.id)) || [];
            let completedCount = 0;
            let inProgressCount = 0;
            for (const registration of rows) {
                const status = registrationStatus(
                    registration,
                    canonicalStates.get(String(registration.id)) || null
                );
                if (status === 'completed') completedCount += 1;
                else if (status === 'in_progress') inProgressCount += 1;
            }
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
                assignmentCount: rows.length,
                completedCount,
                inProgressCount,
                completionPercent: rows.length ? Math.round((completedCount / rows.length) * 100) : 0,
                portalPath: campaign.status === 'active' ? `/campaign/${campaign.id}` : null
            };
        }),
        authOptions: authOptions(authConfig),
        courses: courses.map((course) => ({
            id: course.id,
            title: course.title,
            description: course.description || null,
            status: course.status,
            publishedAt: course.publishedAt || null
        }))
    };
}

module.exports = {
    listCampaigns,
    registrationStatus,
    authOptions
};
