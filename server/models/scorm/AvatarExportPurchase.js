const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const AvatarExportPurchase = sequelize.define('AvatarExportPurchase', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    avatarFingerprint: {
        type: DataTypes.STRING(64),
        allowNull: false
    },
    avatarName: {
        type: DataTypes.STRING(120),
        allowNull: false
    },
    razorpayOrderId: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true
    },
    razorpayPaymentId: {
        type: DataTypes.STRING(80),
        allowNull: true,
        unique: true
    },
    amount: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'INR'
    },
    status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'created'
    },
    paidAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'avatar_export_purchases',
    indexes: [
        { fields: ['userId', 'avatarFingerprint', 'status'] },
        { unique: true, fields: ['razorpayOrderId'] },
        { unique: true, fields: ['razorpayPaymentId'] }
    ]
});

module.exports = AvatarExportPurchase;
