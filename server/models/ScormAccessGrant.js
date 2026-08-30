const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScormAccessGrant = sequelize.define('ScormAccessGrant', {
    email: {
        type: DataTypes.STRING(320),
        allowNull: false,
        unique: true,
        set(value) {
            this.setDataValue('email', String(value || '').trim().toLowerCase());
        }
    },
    role: {
        type: DataTypes.STRING(32),
        allowNull: false,
        // Historical rows used `user`; ScormAccessService normalizes those rows
        // to admin. New grants are explicit workspace administrators by default.
        defaultValue: 'admin'
    },
    addedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    addedByEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    }
}, {
    tableName: 'scorm_access_grants',
    indexes: [
        { unique: true, fields: ['email'] },
        { fields: ['role'] }
    ]
});

module.exports = ScormAccessGrant;
