const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlipbookReaderEvent = sequelize.define('FlipbookReaderEvent', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: false
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
    eventType: {
        type: DataTypes.STRING(32),
        allowNull: false
    },
    pageIndex: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    direction: {
        type: DataTypes.STRING(16),
        allowNull: true
    },
    occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
    }
}, {
    tableName: 'flipbook_reader_events',
    indexes: [
        { fields: ['sessionId'] },
        { fields: ['flipbookId'] },
        { fields: ['ownerUserId'] },
        { fields: ['readerEmail'] },
        { fields: ['eventType'] },
        { fields: ['occurredAt'] },
        { fields: ['flipbookId', 'pageIndex'] }
    ]
});

module.exports = FlipbookReaderEvent;
