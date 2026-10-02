const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCourseCatalogGrant = sequelize.define('ScormCourseCatalogGrant', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    grantKey: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    sourceCourseId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    workspaceId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    scope: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'default'
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'scorm_course_catalog_grants',
    indexes: [
        { unique: true, fields: ['grantKey'] },
        { fields: ['sourceCourseId'] },
        { fields: ['workspaceId'] },
        { fields: ['scope'] }
    ]
});

module.exports = ScormCourseCatalogGrant;
