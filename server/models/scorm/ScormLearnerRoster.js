const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormLearnerRoster = sequelize.define('ScormLearnerRoster', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    hostId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false
    },
    learnerName: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    source: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'manual'
    }
}, {
    tableName: 'scorm_learner_roster',
    indexes: [
        { fields: ['hostId'] },
        { fields: ['hostId', 'email'], unique: true }
    ]
});

module.exports = ScormLearnerRoster;
