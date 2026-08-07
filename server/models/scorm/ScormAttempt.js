const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormAttempt = sequelize.define('ScormAttempt', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    registrationId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    attemptNo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    finishedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    exitType: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'scorm_attempts',
    indexes: [{ fields: ['registrationId'] }]
});

module.exports = ScormAttempt;
