const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormAwarenessEmailCampaignRecipient = sequelize.define('ScormAwarenessEmailCampaignRecipient', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    campaignId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false
    },
    learnerName: {
        type: DataTypes.STRING(180),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'pending'
    },
    provider: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    messageId: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    providerResponse: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    errorCode: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    sentAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_awareness_email_campaign_recipients',
    indexes: [
        { fields: ['campaignId', 'status'] },
        { fields: ['email'] },
        { unique: true, fields: ['campaignId', 'email'] }
    ]
});

module.exports = ScormAwarenessEmailCampaignRecipient;
