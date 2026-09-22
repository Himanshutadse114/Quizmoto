const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormAwarenessEmailTemplate = sequelize.define('ScormAwarenessEmailTemplate', {
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
    title: {
        type: DataTypes.STRING(180),
        allowNull: false
    },
    topic: {
        type: DataTypes.STRING(220),
        allowNull: false
    },
    audience: {
        type: DataTypes.STRING(160),
        allowNull: true
    },
    goal: {
        type: DataTypes.STRING(360),
        allowNull: true
    },
    tone: {
        type: DataTypes.STRING(60),
        allowNull: false,
        defaultValue: 'clear'
    },
    layoutId: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING(240),
        allowNull: false
    },
    preheader: {
        type: DataTypes.STRING(240),
        allowNull: true
    },
    contentJson: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    heroStorageKey: {
        type: DataTypes.STRING(520),
        allowNull: true
    },
    heroContentType: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    heroAltText: {
        type: DataTypes.STRING(320),
        allowNull: true
    },
    publicAssetToken: {
        type: DataTypes.STRING(96),
        allowNull: true
    },
    aiMetadataJson: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'ready'
    }
}, {
    tableName: 'scorm_awareness_email_templates',
    indexes: [
        { fields: ['hostId', 'updatedAt'] },
        { unique: true, fields: ['publicAssetToken'] }
    ]
});

module.exports = ScormAwarenessEmailTemplate;
