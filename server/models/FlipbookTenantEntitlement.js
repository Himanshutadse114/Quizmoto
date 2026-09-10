const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlipbookTenantEntitlement = sequelize.define('FlipbookTenantEntitlement', {
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
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    maxFlipbooks: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 3
    },
    updatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updatedByEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    }
}, {
    tableName: 'flipbook_tenant_entitlements',
    indexes: [
        { unique: true, fields: ['workspaceId'] },
        { fields: ['hostId'] }
    ]
});

module.exports = FlipbookTenantEntitlement;
