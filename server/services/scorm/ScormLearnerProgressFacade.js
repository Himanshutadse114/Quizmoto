const CampaignService = require('./ScormCampaignService');
const LearnerAuthService = require('./ScormLearnerAuthService');
const { enrichDashboardCourses } = require('./ScormCanonicalProgressService');

async function getCampaignDashboard(context) {
    const dashboard = await CampaignService.getCampaignDashboard(context);
    return enrichDashboardCourses(dashboard);
}

async function getLearnerDashboard(context) {
    const dashboard = await LearnerAuthService.getLearnerDashboard(context);
    return enrichDashboardCourses(dashboard);
}

module.exports = {
    getCampaignDashboard,
    getLearnerDashboard
};
