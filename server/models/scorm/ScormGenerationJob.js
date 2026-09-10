const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormGenerationJob = sequelize.define('ScormGenerationJob', {
    progressId: {
        type: DataTypes.STRING(96),
        primaryKey: true,
        allowNull: false
    },
    userId: {
        type: DataTypes.STRING(96),
        allowNull: false
    },
    payloadJson: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'queued'
    },
    percent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    stage: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    detail: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    modelStatus: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    resultJson: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    leaseOwner: {
        type: DataTypes.STRING(160),
        allowNull: true
    },
    leaseExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_generation_jobs',
    indexes: [
        { fields: ['userId', 'status'] },
        { fields: ['status', 'leaseExpiresAt'] },
        { fields: ['updatedAt'] }
    ]
});

module.exports = ScormGenerationJob;
