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
        defaultValue: 'Flipbook Library'
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
