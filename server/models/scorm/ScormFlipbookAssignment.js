const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormFlipbookAssignment = sequelize.define('ScormFlipbookAssignment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    workspaceId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    campaignId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    flipbookId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    learnerEmail: {
        type: DataTypes.STRING(320),
        allowNull: false,
        set(value) {
            this.setDataValue('learnerEmail', String(value || '').trim().toLowerCase());
        }
    },
    learnerName: {
        type: DataTypes.STRING(180),
        allowNull: true
    },
    assignmentToken: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'assigned'
    },
    required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    assignedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    dueAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastActivityAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'scorm_flipbook_assignments',
    indexes: [
        { unique: true, fields: ['assignmentToken'] },
        { fields: ['workspaceId'] },
        { fields: ['hostId'] },
        { fields: ['campaignId'] },
        { fields: ['courseId'] },
        { fields: ['flipbookId'] },
        { fields: ['learnerEmail'] },
        { fields: ['campaignId', 'learnerEmail'] },
        { fields: ['flipbookId', 'learnerEmail'] }
    ]
});

module.exports = ScormFlipbookAssignment;
