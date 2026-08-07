const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

/**
 * Stored xAPI (Tin Can) statements for a registration.
 * Not a full LRS — accepts statements tied to a Quizmoto SCORM registration token.
 */
const ScormXapiStatement = sequelize.define('ScormXapiStatement', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    registrationId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    statementId: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    actorJson: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    verbId: {
        type: DataTypes.STRING(512),
        allowNull: true
    },
    objectId: {
        type: DataTypes.STRING(1024),
        allowNull: true
    },
    resultScoreRaw: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    resultScoreScaled: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    resultSuccess: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    resultCompletion: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    resultDuration: {
        type: DataTypes.STRING(64),
        allowNull: true
    },
    statementJson: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    storedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'scorm_xapi_statements',
    indexes: [
        { fields: ['registrationId'] },
        { fields: ['statementId'] },
        { fields: ['verbId'] }
    ]
});

module.exports = ScormXapiStatement;
