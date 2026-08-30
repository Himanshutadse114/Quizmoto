const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

async function ensureColumn(tableName, columnName, definition) {
    const queryInterface = sequelize.getQueryInterface();
    let description;
    try {
        description = await queryInterface.describeTable(tableName);
    } catch (_) {
        return false;
    }
    if (description[columnName]) return false;
    await queryInterface.addColumn(tableName, columnName, definition);
    return true;
}

async function ensurePlatformSchema() {
    const changes = [];
    const registrationColumns = [
        ['assignedAt', { type: DataTypes.DATE, allowNull: true }],
        ['assignedByUserId', { type: DataTypes.INTEGER, allowNull: true }],
        ['dueAt', { type: DataTypes.DATE, allowNull: true }],
        ['assignmentSource', { type: DataTypes.STRING(32), allowNull: true }],
        ['required', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }]
    ];

    for (const [name, definition] of registrationColumns) {
        if (await ensureColumn('scorm_registrations', name, definition)) {
            changes.push(`scorm_registrations.${name}`);
        }
    }
    return { changed: changes.length > 0, changes };
}

module.exports = { ensurePlatformSchema };
