const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlipbookReaderContext = sequelize.define('FlipbookReaderContext', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    assignmentId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    workspaceId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    campaignId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    flipbookId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    sourceType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'public_share'
    }
}, {
    tableName: 'flipbook_reader_contexts',
    indexes: [
        { unique: true, fields: ['sessionId'] },
        { fields: ['assignmentId'] },
        { fields: ['workspaceId'] },
        { fields: ['campaignId'] },
        { fields: ['courseId'] },
        { fields: ['flipbookId'] },
        { fields: ['courseId', 'flipbookId'] }
    ]
});

module.exports = FlipbookReaderContext;
