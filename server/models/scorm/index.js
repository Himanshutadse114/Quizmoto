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
const ScormAccessGrant = require('../ScormAccessGrant');
const ScormAccessRequest = require('../ScormAccessRequest');

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

module.exports = {
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
    ScormAccessGrant,
    ScormAccessRequest
};
