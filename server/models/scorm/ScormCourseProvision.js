const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCourseProvision = sequelize.define('ScormCourseProvision', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sourceCourseId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    targetHostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    targetWorkspaceId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    packageId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'scorm_course_provisions',
    indexes: [
        { unique: true, fields: ['sourceCourseId', 'targetHostId'], name: 'scorm_course_provisions_source_host_uq' },
        { unique: true, fields: ['courseId'] },
        { fields: ['targetWorkspaceId'] },
        { fields: ['targetHostId', 'active'] }
    ]
});

module.exports = ScormCourseProvision;
