const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormWorkspaceMember = sequelize.define('ScormWorkspaceMember', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    workspaceId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false,
        unique: true,
        set(value) {
            this.setDataValue('email', String(value || '').trim().toLowerCase());
        }
    },
    displayName: {
        type: DataTypes.STRING(160),
        allowNull: true
    },
    role: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'co_admin'
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'invited'
    },
    invitedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    invitedByEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    },
    joinedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_workspace_members',
    indexes: [
        { unique: true, fields: ['email'] },
        { unique: true, fields: ['workspaceId', 'email'] },
        { fields: ['workspaceId', 'role'] },
        { fields: ['userId'] },
        { fields: ['status'] }
    ]
});

module.exports = ScormWorkspaceMember;
