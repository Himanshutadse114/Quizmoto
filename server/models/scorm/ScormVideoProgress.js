const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormVideoProgress = sequelize.define('ScormVideoProgress', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    workspaceId: { type: DataTypes.UUID, allowNull: false },
    campaignId: { type: DataTypes.UUID, allowNull: false },
    videoId: { type: DataTypes.UUID, allowNull: false },
    learnerEmail: {
        type: DataTypes.STRING(320),
        allowNull: false,
        set(value) { this.setDataValue('learnerEmail', String(value || '').trim().toLowerCase()); }
    },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'assigned' },
    watchedRanges: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    watchedSeconds: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    activeSeconds: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    lastPositionSeconds: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    durationSeconds: { type: DataTypes.FLOAT, allowNull: true },
    playCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    seekCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    lastActivityAt: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'scorm_video_progress',
    indexes: [
        { fields: ['workspaceId'] },
        { fields: ['campaignId'] },
        { fields: ['videoId'] },
        { fields: ['learnerEmail'] },
        { unique: true, fields: ['campaignId', 'videoId', 'learnerEmail'] }
    ]
});

module.exports = ScormVideoProgress;
