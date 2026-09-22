const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormAwarenessLibraryTemplate = sequelize.define('ScormAwarenessLibraryTemplate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    seedKey: {
        type: DataTypes.STRING(180),
        allowNull: true,
        unique: true
    },
    title: {
        type: DataTypes.STRING(180),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    subject: {
        type: DataTypes.STRING(240),
        allowNull: false
    },
    htmlTemplate: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    assetManifestJson: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '[]'
    },
    publicAssetToken: {
        type: DataTypes.STRING(96),
        allowNull: false,
        unique: true
    },
    coverAssetId: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    sourceFileName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    sourceEntryPath: {
        type: DataTypes.STRING(520),
        allowNull: true
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'scorm_awareness_library_templates',
    indexes: [
        { fields: ['isActive', 'updatedAt'] },
        { fields: ['category'] },
        { unique: true, fields: ['publicAssetToken'] }
    ]
});

module.exports = ScormAwarenessLibraryTemplate;
