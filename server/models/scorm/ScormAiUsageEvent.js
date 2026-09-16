const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormAiUsageEvent = sequelize.define('ScormAiUsageEvent', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    entitlementEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    },
    operationKey: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true
    },
    kind: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'course_generation'
    },
    source: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'ai_author'
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'reserved'
    },
    reservesActiveSlot: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    packageId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
    }
}, {
    tableName: 'scorm_ai_usage_events',
    indexes: [
        { fields: ['operationKey'], unique: true },
        { fields: ['hostId'] },
        { fields: ['hostId', 'status'] }
    ]
});

module.exports = ScormAiUsageEvent;
