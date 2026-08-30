const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormWorkspaceAuthConfig = sequelize.define('ScormWorkspaceAuthConfig', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    workspaceId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    joiningMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'assigned_email'
    },
    googleEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    googleClientId: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    microsoftEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    microsoftClientId: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    microsoftTenantId: {
        type: DataTypes.STRING(128),
        allowNull: true
    },
    allowedDomainsJson: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    updatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'scorm_workspace_auth_configs',
    indexes: [
        { unique: true, fields: ['workspaceId'] }
    ]
});

module.exports = ScormWorkspaceAuthConfig;
