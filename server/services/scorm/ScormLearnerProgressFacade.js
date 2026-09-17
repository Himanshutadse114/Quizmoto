const CampaignService = require('./ScormCampaignService');
const LearnerAuthService = require('./ScormLearnerAuthService');
const { enrichDashboardCourses, loadCanonicalStates, enrichCourse } = require('./ScormCanonicalProgressService');

async function getCampaignDashboard(context) {
    const dashboard = await CampaignService.getCampaignDashboard(context);
    return enrichDashboardCourses(dashboard);
}

async function getLearnerDashboard(context) {
    const dashboard = await LearnerAuthService.getLearnerDashboard(context);
    const enriched = await enrichDashboardCourses(dashboard);
    if (!Array.isArray(enriched.campaigns) || !enriched.campaigns.length) return enriched;
    const campaignCourses = enriched.campaigns.flatMap((campaign) => Array.isArray(campaign.courses) ? campaign.courses : []);
    const campaignStates = await loadCanonicalStates(campaignCourses);
    const { getCampaignDashboardFlipbooks } = require('./ScormFlipbookAssignmentService');
    const { getCampaignDashboardVideos } = require('./ScormVideoService');
    enriched.campaigns = await Promise.all(enriched.campaigns.map(async (campaign) => {
        const campaignContext = { ...context, campaignId: campaign.id };
        const [flipbooks, videos] = await Promise.all([
            getCampaignDashboardFlipbooks(campaignContext),
            getCampaignDashboardVideos(campaignContext)
        ]);
        const courses = (campaign.courses || []).map((course) => enrichCourse(course, campaignStates.get(String(course.registrationId || course.instanceId || '')) || null));
        return { ...campaign, courses, flipbooks, videos };
    }));
    return enriched;
}

module.exports = {
    getCampaignDashboard,
    getLearnerDashboard
};
