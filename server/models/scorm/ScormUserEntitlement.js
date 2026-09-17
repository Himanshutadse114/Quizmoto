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
    // Lifetime AI course-generation credits. Deleting/archiving a generated
    // course never refunds the underlying AI work recorded in the usage ledger.
    maxCourses: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Maximum courses currently available in the tenant library. Archiving or
    // deleting a course frees this capacity without refunding AI credits.
    maxActiveCourses: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Maximum distinct learners that can be actively assigned learning.
    maxLearners: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Maximum current staff members in the tenant, including the primary Admin.
    maxStaff: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Maximum campaigns stored for the tenant.
    maxCampaigns: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Maximum active learner-course assignment pairs.
    maxAssignments: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Maximum connected Quizmoto players across this user or tenant at one time.
    maxQuizPlayers: {
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
