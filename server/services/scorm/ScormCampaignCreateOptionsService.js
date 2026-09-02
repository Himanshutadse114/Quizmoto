const {
    ScormCourse,
    ScormWorkspaceAuthConfig
} = require('../../models/scorm');

function authOptions(config) {
    return {
        emailCode: true,
        googleConfigured: Boolean(config?.googleEnabled && config?.googleClientId),
        microsoftConfigured: Boolean(config?.microsoftEnabled && config?.microsoftClientId && config?.microsoftTenantId)
    };
}

async function getCampaignCreateOptions({ hostId, workspaceId }) {
    const [courses, authConfig] = await Promise.all([
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

    return {
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
    getCampaignCreateOptions,
    authOptions
};
