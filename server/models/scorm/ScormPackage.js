const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormPackage = sequelize.define('ScormPackage', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Untitled package'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    standard: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'scorm_1_2'
    },
    storageKeyZip: {
        type: DataTypes.STRING,
        allowNull: true
    },
    storagePrefixContent: {
        type: DataTypes.STRING,
        allowNull: true
    },
    entryHref: {
        type: DataTypes.STRING,
        allowNull: true
    },
    manifestHash: {
        type: DataTypes.STRING,
        allowNull: true
    },
    byteSize: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    fileCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'processing'
    },
    source: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'upload'
    },
    templateId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    /** Policy analysis JSON for AI packages — enables edit & regenerate */
    analysisJson: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'scorm_packages',
    indexes: [{ fields: ['hostId'] }, { fields: ['status'] }]
});

module.exports = ScormPackage;
