const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlipbookEntitlement = sequelize.define('FlipbookEntitlement', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: true
    },
    // Null means unlimited. New users receive three free flipbooks by default.
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
    tableName: 'flipbook_entitlements',
    indexes: [
        { unique: true, fields: ['userId'] },
        { fields: ['email'] }
    ]
});

module.exports = FlipbookEntitlement;
