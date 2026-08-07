const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCourse = sequelize.define('ScormCourse', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    packageId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    inviteCode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'draft'
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
    },
    publishedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_courses',
    indexes: [{ fields: ['hostId'] }, { fields: ['inviteCode'], unique: true }]
});

module.exports = ScormCourse;
