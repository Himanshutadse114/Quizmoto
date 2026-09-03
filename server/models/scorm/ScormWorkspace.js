const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ScormWorkspace = sequelize.define('ScormWorkspace', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    ownerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING(160),
        allowNull: false
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'active'
    },
    logoDataUrl: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'scorm_workspaces',
    indexes: [
        { unique: true, fields: ['ownerUserId'] },
        { fields: ['status'] }
    ]
});

module.exports = ScormWorkspace;
