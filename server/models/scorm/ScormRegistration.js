const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormRegistration = sequelize.define('ScormRegistration', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    campaignId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    learnerUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    learnerEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    learnerName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    inviteTokenHash: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'invited'
    },
    isPreview: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    assignedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    assignedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    dueAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    assignmentSource: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    lastLessonStatus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastScoreRaw: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    lastTotalTime: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastCommitAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_registrations',
    indexes: [
        { fields: ['courseId'] },
        { fields: ['campaignId'] },
        { fields: ['campaignId', 'isPreview', 'status'], name: 'scorm_registrations_campaign_runtime_idx' },
        { fields: ['status'] },
        { fields: ['learnerEmail'] },
        { fields: ['assignedAt'] }
    ]
});

module.exports = ScormRegistration;
