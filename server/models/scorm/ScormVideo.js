const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormVideo = sequelize.define('ScormVideo', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    workspaceId: { type: DataTypes.UUID, allowNull: false },
    hostId: { type: DataTypes.INTEGER, allowNull: false },
    ownerUserId: { type: DataTypes.INTEGER, allowNull: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    storageKey: { type: DataTypes.STRING(500), allowNull: false },
    mimeType: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'video/mp4' },
    byteSize: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    durationSeconds: { type: DataTypes.FLOAT, allowNull: true },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'ready' }
}, {
    tableName: 'scorm_videos',
    indexes: [
        { fields: ['workspaceId'] },
        { fields: ['hostId'] },
        { fields: ['status'] }
    ]
});

module.exports = ScormVideo;
