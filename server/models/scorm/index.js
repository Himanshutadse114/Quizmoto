const ScormPackage = require('./ScormPackage');
const ScormCourse = require('./ScormCourse');
const ScormRegistration = require('./ScormRegistration');
const ScormAttempt = require('./ScormAttempt');
const ScormCmiState = require('./ScormCmiState');
const ScormXapiStatement = require('./ScormXapiStatement');

ScormPackage.hasMany(ScormCourse, { foreignKey: 'packageId', as: 'courses' });
ScormCourse.belongsTo(ScormPackage, { foreignKey: 'packageId', as: 'package' });

ScormCourse.hasMany(ScormRegistration, { foreignKey: 'courseId', as: 'registrations' });
ScormRegistration.belongsTo(ScormCourse, { foreignKey: 'courseId', as: 'course' });

ScormRegistration.hasMany(ScormAttempt, { foreignKey: 'registrationId', as: 'attempts' });
ScormAttempt.belongsTo(ScormRegistration, { foreignKey: 'registrationId', as: 'registration' });

ScormRegistration.hasOne(ScormCmiState, { foreignKey: 'registrationId', as: 'cmiState' });
ScormCmiState.belongsTo(ScormRegistration, { foreignKey: 'registrationId', as: 'registration' });

ScormRegistration.hasMany(ScormXapiStatement, { foreignKey: 'registrationId', as: 'xapiStatements' });
ScormXapiStatement.belongsTo(ScormRegistration, { foreignKey: 'registrationId', as: 'registration' });

module.exports = {
    ScormPackage,
    ScormCourse,
    ScormRegistration,
    ScormAttempt,
    ScormCmiState,
    ScormXapiStatement
};
