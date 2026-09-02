const ScormPackage = require('./ScormPackage');
const ScormCourse = require('./ScormCourse');
const ScormRegistration = require('./ScormRegistration');
const ScormAttempt = require('./ScormAttempt');
const ScormCmiState = require('./ScormCmiState');
const ScormRuntimeSnapshot = require('./ScormRuntimeSnapshot');
const ScormXapiStatement = require('./ScormXapiStatement');
const ScormLearnerRoster = require('./ScormLearnerRoster');
const ScormUserEntitlement = require('./ScormUserEntitlement');
const ScormWorkspace = require('./ScormWorkspace');
const ScormWorkspaceMember = require('./ScormWorkspaceMember');
const ScormWorkspaceAuthConfig = require('./ScormWorkspaceAuthConfig');
const ScormCampaign = require('./ScormCampaign');
const ScormCampaignLearner = require('./ScormCampaignLearner');
const ScormCampaignCourse = require('./ScormCampaignCourse');
const ScormAccessGrant = require('../ScormAccessGrant');
const ScormAccessRequest = require('../ScormAccessRequest');
const MailOtp = require('../MailOtp');
const MailTemplateOverride = require('../MailTemplateOverride');

ScormPackage.hasMany(ScormCourse, { foreignKey: 'packageId', as: 'courses' });
ScormCourse.belongsTo(ScormPackage, { foreignKey: 'packageId', as: 'package' });

ScormCourse.hasMany(ScormRegistration, { foreignKey: 'courseId', as: 'registrations' });
ScormRegistration.belongsTo(ScormCourse, { foreignKey: 'courseId', as: 'course' });

ScormRegistration.hasMany(ScormAttempt, { foreignKey: 'registrationId', as: 'attempts' });
ScormAttempt.belongsTo(ScormRegistration, { foreignKey: 'registrationId', as: 'registration' });

ScormRegistration.hasOne(ScormCmiState, { foreignKey: 'registrationId', as: 'cmiState' });
ScormCmiState.belongsTo(ScormRegistration, { foreignKey: 'registrationId', as: 'registration' });

ScormRegistration.hasOne(ScormRuntimeSnapshot, { foreignKey: 'registrationId', as: 'runtimeSnapshot' });
ScormRuntimeSnapshot.belongsTo(ScormRegistration, { foreignKey: 'registrationId', as: 'registration' });

ScormRegistration.hasMany(ScormXapiStatement, { foreignKey: 'registrationId', as: 'xapiStatements' });
ScormXapiStatement.belongsTo(ScormRegistration, { foreignKey: 'registrationId', as: 'registration' });

ScormWorkspace.hasMany(ScormWorkspaceMember, {
    foreignKey: 'workspaceId',
    as: 'members',
    onDelete: 'CASCADE'
});
ScormWorkspaceMember.belongsTo(ScormWorkspace, {
    foreignKey: 'workspaceId',
    as: 'workspace'
});

ScormWorkspace.hasOne(ScormWorkspaceAuthConfig, {
    foreignKey: 'workspaceId',
    as: 'authConfig',
    onDelete: 'CASCADE'
});
ScormWorkspaceAuthConfig.belongsTo(ScormWorkspace, {
    foreignKey: 'workspaceId',
    as: 'workspace'
});

ScormWorkspace.hasMany(ScormCampaign, { foreignKey: 'workspaceId', as: 'campaigns', onDelete: 'CASCADE' });
ScormCampaign.belongsTo(ScormWorkspace, { foreignKey: 'workspaceId', as: 'workspace' });

ScormCampaign.hasMany(ScormCampaignLearner, { foreignKey: 'campaignId', as: 'learners', onDelete: 'CASCADE' });
ScormCampaignLearner.belongsTo(ScormCampaign, { foreignKey: 'campaignId', as: 'campaign' });

ScormCampaign.hasMany(ScormCampaignCourse, { foreignKey: 'campaignId', as: 'campaignCourses', onDelete: 'CASCADE' });
ScormCampaignCourse.belongsTo(ScormCampaign, { foreignKey: 'campaignId', as: 'campaign' });
ScormCampaignCourse.belongsTo(ScormCourse, { foreignKey: 'courseId', as: 'course' });
ScormCourse.hasMany(ScormCampaignCourse, { foreignKey: 'courseId', as: 'campaignLinks' });

ScormCampaign.hasMany(ScormRegistration, { foreignKey: 'campaignId', as: 'registrations' });
ScormRegistration.belongsTo(ScormCampaign, { foreignKey: 'campaignId', as: 'campaign' });

const models = {
    ScormPackage,
    ScormCourse,
    ScormRegistration,
    ScormAttempt,
    ScormCmiState,
    ScormRuntimeSnapshot,
    ScormXapiStatement,
    ScormLearnerRoster,
    ScormUserEntitlement,
    ScormWorkspace,
    ScormWorkspaceMember,
    ScormWorkspaceAuthConfig,
    ScormCampaign,
    ScormCampaignLearner,
    ScormCampaignCourse,
    ScormAccessGrant,
    ScormAccessRequest,
    MailOtp,
    MailTemplateOverride
};

module.exports = models;

// Register non-blocking email notifications after every model exists. The hook
// service receives the models directly to avoid circular model imports.
require('../../services/mail/MailNotificationHooks').register(models);
