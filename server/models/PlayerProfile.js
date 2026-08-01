const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const PlayerProfile = sequelize.define('PlayerProfile', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    email: {
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
    xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    avatar: {
        type: DataTypes.STRING,
        defaultValue: 'default_avatar.png'
    },
    gamesPlayed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    hooks: {
        beforeCreate: async (player) => {
            if (player.password) {
                player.password = await bcrypt.hash(player.password, 10);
            }
        },
        beforeUpdate: async (player) => {
            if (player.changed('password') && player.password) {
                player.password = await bcrypt.hash(player.password, 10);
            }
        }
    }
});

PlayerProfile.prototype.comparePassword = function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = { PlayerProfile };
