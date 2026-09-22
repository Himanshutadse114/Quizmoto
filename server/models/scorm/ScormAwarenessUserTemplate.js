const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormAwarenessUserTemplate = sequelize.define('ScormAwarenessUserTemplate', {
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
    centralTemplateId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    title: {
        type: DataTypes.STRING(180),
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING(240),
        allowNull: false
    },
    htmlContent: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    userAssetManifestJson: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '[]'
    },
    publicAssetToken: {
        type: DataTypes.STRING(96),
        allowNull: false,
        unique: true
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'ready'
    },
    lastSentAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_awareness_user_templates',
    indexes: [
        { fields: ['hostId', 'updatedAt'] },
        { fields: ['centralTemplateId'] },
        { unique: true, fields: ['publicAssetToken'] }
    ]
});

module.exports = ScormAwarenessUserTemplate;
