const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormUserEntitlement = sequelize.define('ScormUserEntitlement', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING(320),
        allowNull: false,
        unique: true,
        set(value) {
            this.setDataValue('email', String(value || '').trim().toLowerCase());
        }
    },
    maxCourses: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    maxLearners: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    permissions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
    },
    updatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updatedByEmail: {
        type: DataTypes.STRING(320),
        allowNull: true
    }
}, {
    tableName: 'scorm_user_entitlements',
    indexes: [{ unique: true, fields: ['email'] }]
});

module.exports = ScormUserEntitlement;
