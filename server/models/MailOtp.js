const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MailOtp = sequelize.define('MailOtp', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false
    },
    purpose: {
        type: DataTypes.STRING(40),
        allowNull: false
    },
    codeHash: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    consumedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    requestedIp: {
        type: DataTypes.STRING(80),
        allowNull: true
    }
}, {
    tableName: 'mail_otps',
    indexes: [
        { fields: ['email', 'purpose', 'createdAt'] },
        { fields: ['expiresAt'] }
    ]
});

module.exports = MailOtp;
