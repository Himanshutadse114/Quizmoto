const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlipbookTenantLink = sequelize.define('FlipbookTenantLink', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    flipbookId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    workspaceId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    createdByEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    }
}, {
    tableName: 'flipbook_tenant_links',
    indexes: [
        { unique: true, fields: ['flipbookId'] },
        { fields: ['workspaceId'] },
        { fields: ['hostId'] },
        { fields: ['createdByUserId'] },
        { fields: ['workspaceId', 'createdAt'] }
    ]
});

module.exports = FlipbookTenantLink;
