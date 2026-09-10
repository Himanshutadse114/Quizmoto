const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlipbookReaderSession = sequelize.define('FlipbookReaderSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    flipbookId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    ownerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    readerEmail: {
        type: DataTypes.STRING(320),
        allowNull: false
    },
    readerName: {
        type: DataTypes.STRING(160),
        allowNull: true
    },
    sessionToken: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
    },
    source: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    durationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    pageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    uniquePages: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
    },
    lastPageIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    maxPageIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    flipCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    deviceType: {
        type: DataTypes.STRING(32),
        allowNull: true
    },
    userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    referrer: {
        type: DataTypes.STRING(1000),
        allowNull: true
    },
    ipHash: {
        type: DataTypes.STRING(64),
        allowNull: true
    }
}, {
    tableName: 'flipbook_reader_sessions',
    indexes: [
        { fields: ['flipbookId'] },
        { fields: ['ownerUserId'] },
        { fields: ['readerEmail'] },
        { unique: true, fields: ['sessionToken'] },
        { fields: ['startedAt'] }
    ]
});

module.exports = FlipbookReaderSession;
