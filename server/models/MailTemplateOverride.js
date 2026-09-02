const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MailTemplateOverride = sequelize.define('MailTemplateOverride', {
    templateKey: {
        type: DataTypes.STRING(80),
        allowNull: false,
        primaryKey: true
    },
    subjectTemplate: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    htmlTemplate: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    updatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'mail_template_overrides'
});

module.exports = MailTemplateOverride;
