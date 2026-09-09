const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Flipbook = sequelize.define('Flipbook', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    ownerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ownerEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    },
    title: {
        type: DataTypes.STRING(180),
        allowNull: false,
        defaultValue: 'Untitled flipbook'
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
    status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'draft'
    },
    shareEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    pages: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
    },
    pageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    viewCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    lastViewedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    publishedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    theme: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
    }
}, {
    tableName: 'flipbooks',
    indexes: [
        { fields: ['ownerUserId'] },
        { fields: ['ownerEmail'] },
        { unique: true, fields: ['shareToken'] },
        { fields: ['status'] }
    ]
});

module.exports = Flipbook;
