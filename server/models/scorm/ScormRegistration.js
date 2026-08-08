const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormRegistration = sequelize.define('ScormRegistration', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    courseId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    learnerUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    learnerEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    learnerName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    inviteTokenHash: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'invited'
    },
    isPreview: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    lastLessonStatus: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastScoreRaw: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    lastProgressPercent: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    lastLessonLocation: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    lastTotalTime: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastCommitAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'scorm_registrations',
    indexes: [{ fields: ['courseId'] }, { fields: ['status'] }]
});

module.exports = ScormRegistration;