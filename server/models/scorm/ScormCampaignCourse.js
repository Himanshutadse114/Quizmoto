const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCampaignCourse = sequelize.define('ScormCampaignCourse', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    campaignId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    tableName: 'scorm_campaign_courses',
    indexes: [
        { fields: ['campaignId'] },
        { fields: ['courseId'] },
        { unique: true, fields: ['campaignId', 'courseId'] }
    ]
});

module.exports = ScormCampaignCourse;
