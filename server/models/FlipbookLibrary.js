const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlipbookLibrary = sequelize.define('FlipbookLibrary', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    ownerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    ownerEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    },
    title: {
        type: DataTypes.STRING(180),
        allowNull: false,
        defaultValue: 'Publica Library'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    shareToken: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
    },
    shareSlug: {
        type: DataTypes.STRING(64),
        allowNull: true,
        unique: true
    },
    customSubdomain: {
        type: DataTypes.STRING(63),
        allowNull: true,
        unique: true
    },
    shareEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'flipbook_libraries',
    indexes: [
        { unique: true, fields: ['ownerUserId'] },
        { unique: true, fields: ['shareToken'] }
    ]
});

module.exports = FlipbookLibrary;
