const { Op, fn, col, literal } = require('sequelize');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormCampaignCourse,
    ScormCourse,
    ScormRegistration
} = require('../../models/scorm');
const {
    normalizeStoredAuthMode,
    authModeLabel
} = require('./ScormCampaignAuthPolicy');

const ACTIVE_REGISTRATION_STATUSES = { [Op.notIn]: ['revoked', 'superseded'] };

function fail(message, code, status = 400) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}

async function findCampaign({ campaignId, hostId, workspaceId }) {
    const campaign = await ScormCampaign.findOne({
        where: { id: campaignId, hostId, workspaceId },
        attributes: ['id', 'name', 'status', 'authMode', 'dueAt', 'required', 'createdAt', 'startedAt'],
        raw: true
    });
    if (!campaign) throw fail('Campaign not found.', 'SCORM_CAMPAIGN_NOT_FOUND', 404);
    return campaign;
}

async function learnerProgressRows(campaignId) {
    return ScormRegistration.findAll({
        attributes: [
            'learnerEmail',
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
                THEN 1 ELSE 0 END)`), 'inProgressCount'],
            [fn('MAX', col('lastCommitAt')), 'lastActivityAt']
        ],
        where: {
            campaignId,
            isPreview: false,
            status: ACTIVE_REGISTRATION_STATUSES,
            learnerEmail: { [Op.ne]: null }
        },
        group: ['learnerEmail'],
        raw: true
    });
}

function learnerProgressStatus(row) {
    const assignments = Number(row?.assignmentCount || 0);
    const completed = Number(row?.completedCount || 0);
    const inProgress = Number(row?.inProgressCount || 0);
    if (assignments > 0 && completed >= assignments) return 'completed';
    if (completed > 0 || inProgress > 0) return 'in_progress';
    return 'not_started';
}

function baseCampaign(campaign, learners, courses, progressRows) {
    const assignmentCount = progressRows.reduce((sum, row) => sum + Number(row.assignmentCount || 0), 0);
    const completedCount = progressRows.reduce((sum, row) => sum + Number(row.completedCount || 0), 0);
    const inProgressCount = progressRows.reduce((sum, row) => sum + Number(row.inProgressCount || 0), 0);
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
        learnerCount: learners.length,
        courseCount: courses.length,
        assignmentCount,
        completedCount,
        inProgressCount,
        completionPercent: assignmentCount ? Math.round((completedCount / assignmentCount) * 100) : 0,
        portalPath: campaign.status === 'active' ? `/campaign/${campaign.id}` : null
    };
}

async function getCompactCampaignDetail({ campaignId, hostId, workspaceId, manage = false }) {
    const campaign = await findCampaign({ campaignId, hostId, workspaceId });
    const [learners, courseLinks, progressRows] = await Promise.all([
        ScormCampaignLearner.findAll({
            where: { campaignId },
            attributes: ['id', 'email', 'learnerName'],
            order: [['learnerName', 'ASC'], ['email', 'ASC']],
            raw: true
        }),
        ScormCampaignCourse.findAll({
            where: { campaignId },
            attributes: ['courseId'],
            include: [{
                model: ScormCourse,
                as: 'course',
                attributes: ['id', 'title', 'status']
            }]
        }),
        learnerProgressRows(campaignId)
    ]);

    const courses = courseLinks.map((link) => ({
        id: link.courseId,
        title: link.course?.title || 'Course',
        status: link.course?.status || null
    }));
    const progressByEmail = new Map(progressRows.map((row) => [String(row.learnerEmail || '').toLowerCase(), row]));
    const learnerItems = learners.map((learner) => {
        const progress = progressByEmail.get(String(learner.email || '').toLowerCase()) || null;
        return {
            id: learner.id,
            email: learner.email,
            learnerName: learner.learnerName || null,
            ...(manage ? {
                progressStatus: learnerProgressStatus(progress),
                assignmentCount: Number(progress?.assignmentCount || 0),
                completedAssignments: Number(progress?.completedCount || 0),
                lastActivityAt: progress?.lastActivityAt || null
            } : {})
        };
    });

    const result = {
        ...baseCampaign(campaign, learners, courses, progressRows),
        learners: learnerItems,
        courses
    };

    if (manage) {
        // Preserve the existing frontend contract without returning every
        // learner-course registration. One compact synthetic row per learner is
        // enough for complete/in-progress/not-started status and reminder logic.
        result.registrations = learnerItems
            .filter((learner) => learner.assignmentCount > 0)
            .map((learner) => ({
                learnerEmail: learner.email,
                learnerName: learner.learnerName,
                status: learner.progressStatus === 'completed'
                    ? 'completed'
                    : learner.progressStatus === 'in_progress'
                        ? 'in_progress'
                        : 'invited',
                lastLessonStatus: learner.progressStatus === 'completed' ? 'completed' : null,
                lastActivityAt: learner.lastActivityAt,
                lastCommitAt: learner.lastActivityAt,
                score: null
            }));
    }

    return result;
}

async function getCampaignSummaryDetail(args) {
    return getCompactCampaignDetail({ ...args, manage: false });
}

async function getCampaignManageDetail(args) {
    return getCompactCampaignDetail({ ...args, manage: true });
}

module.exports = {
    getCampaignSummaryDetail,
    getCampaignManageDetail,
    learnerProgressRows,
    learnerProgressStatus
};
