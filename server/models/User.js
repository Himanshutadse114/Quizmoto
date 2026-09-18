const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true
    },
    googleId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    displayName: {
        type: DataTypes.STRING(160),
        allowNull: true
    },
    avatar: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    accountStatus: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'active'
    },
    removedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    blockedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    authVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password') && user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
});

User.prototype.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
