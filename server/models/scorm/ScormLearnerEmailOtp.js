const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormLearnerEmailOtp = sequelize.define('ScormLearnerEmailOtp', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    workspaceId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false
    },
    purpose: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: 'learner_signin'
    },
    codeHash: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    consumedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    sentAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'scorm_learner_email_otps',
    indexes: [
        { fields: ['workspaceId', 'email', 'purpose'] },
        { fields: ['expiresAt'] },
        { fields: ['consumedAt'] }
    ]
});

module.exports = ScormLearnerEmailOtp;
