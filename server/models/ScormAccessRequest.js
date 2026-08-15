const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScormAccessRequest = sequelize.define('ScormAccessRequest', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false,
        unique: true,
        set(value) {
            this.setDataValue('email', String(value || '').trim().toLowerCase());
        }
    },
    username: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    authMethod: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'password'
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'pending'
    },
    requestedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    approvedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    approvedByEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    }
}, {
    tableName: 'scorm_access_requests',
    indexes: [
        { unique: true, fields: ['email'] },
        { fields: ['status'] },
        { fields: ['userId'] }
    ]
});

module.exports = ScormAccessRequest;
