const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCampaignVideo = sequelize.define('ScormCampaignVideo', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaignId: { type: DataTypes.UUID, allowNull: false },
    videoId: { type: DataTypes.UUID, allowNull: false },
    required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
    tableName: 'scorm_campaign_videos',
    indexes: [
        { fields: ['campaignId'] },
        { fields: ['videoId'] },
        { unique: true, fields: ['campaignId', 'videoId'] }
    ]
});

module.exports = ScormCampaignVideo;
