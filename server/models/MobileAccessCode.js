const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

// One-time access codes that let the LMSGEN Android app sign in without a
// password (works like app passwords). Only the SHA-256 hash of a code is ever
// persisted — the plaintext is returned once at creation time and cannot be
// recovered afterwards.
const MobileAccessCode = sequelize.define('MobileAccessCode', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    // Matches the User model's primary key (Sequelize default: integer
    // auto-increment, table "Users").
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: User, key: 'id' }
    },
    codeHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
    },
    label: {
        type: DataTypes.STRING(120),
        allowNull: true
    },
    lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    revokedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'mobile_access_codes',
    indexes: [
        { fields: ['userId', 'revokedAt'] },
        { fields: ['expiresAt'] }
    ]
});

MobileAccessCode.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(MobileAccessCode, { foreignKey: 'userId', as: 'mobileAccessCodes' });

module.exports = MobileAccessCode;
