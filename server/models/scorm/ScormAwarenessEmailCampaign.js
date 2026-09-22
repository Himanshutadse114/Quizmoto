const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormAwarenessEmailCampaign = sequelize.define('ScormAwarenessEmailCampaign', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    userTemplateId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(180),
        allowNull: false
    },
    templateTitle: {
        type: DataTypes.STRING(180),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'draft'
    },
    subjectSnapshot: {
        type: DataTypes.STRING(240),
        allowNull: true
    },
    htmlSnapshot: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mailBatchCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
    },
    mailBatchDelaySeconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60
    },
    recipientCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    sentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    failedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    endedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastError: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'scorm_awareness_email_campaigns',
    indexes: [
        { fields: ['hostId', 'createdAt'] },
        { fields: ['hostId', 'status'] },
        { fields: ['userTemplateId'] }
    ]
});

module.exports = ScormAwarenessEmailCampaign;
