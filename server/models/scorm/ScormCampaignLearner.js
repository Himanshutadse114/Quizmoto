const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCampaignLearner = sequelize.define('ScormCampaignLearner', {
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
    }
}, {
    tableName: 'scorm_campaign_learners',
    indexes: [
        { fields: ['campaignId'] },
        { fields: ['email'] },
        { unique: true, fields: ['campaignId', 'email'] }
    ]
});

module.exports = ScormCampaignLearner;
