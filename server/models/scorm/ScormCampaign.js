const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCampaign = sequelize.define('ScormCampaign', {
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
    name: {
        type: DataTypes.STRING(180),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'draft'
    },
    authMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'sso_any'
    },
    dueAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    endedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_campaigns',
    indexes: [
        { fields: ['workspaceId'] },
        { fields: ['hostId'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
        { fields: ['workspaceId', 'hostId', 'createdAt'], name: 'scorm_campaigns_workspace_host_created_idx' },
        { fields: ['workspaceId', 'hostId', 'status'], name: 'scorm_campaigns_workspace_host_status_idx' }
    ]
});

module.exports = ScormCampaign;
