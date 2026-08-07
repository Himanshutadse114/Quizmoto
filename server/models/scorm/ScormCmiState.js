const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormCmiState = sequelize.define('ScormCmiState', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    registrationId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    attemptId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    lessonStatus: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'not attempted'
    },
    scoreRaw: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    scoreMin: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    scoreMax: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    lessonLocation: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    suspendData: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    entry: {
        type: DataTypes.STRING,
        allowNull: true
    },
    exit: {
        type: DataTypes.STRING,
        allowNull: true
    },
    totalTime: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: '00:00:00.00'
    },
    sessionTime: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: '00:00:00.00'
    },
    interactionsJson: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    rawMapJson: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    stateVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    initialized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'scorm_cmi_states',
    indexes: [{ fields: ['registrationId'], unique: true }]
});

module.exports = ScormCmiState;
