const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCampaignFlipbook = sequelize.define('ScormCampaignFlipbook', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    campaignId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    flipbookId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    // Optional course association. When set, Flipbook analytics can be reported
    // as supporting evidence for this specific course assignment.
    courseId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'scorm_campaign_flipbooks',
    indexes: [
        { fields: ['campaignId'] },
        { fields: ['flipbookId'] },
        { fields: ['courseId'] },
        { fields: ['campaignId', 'flipbookId'] }
    ]
});

module.exports = ScormCampaignFlipbook;
