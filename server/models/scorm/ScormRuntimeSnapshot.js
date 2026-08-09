const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

/**
 * Canonical SCORM runtime persistence.
 *
 * The historic scorm_cmi_states table accumulated additive schema changes over
 * several deployments. A single opaque snapshot keeps the LMS runtime atomic
 * and prevents legacy column/type drift from breaking Commit/Finish.
 */
const ScormRuntimeSnapshot = sequelize.define('ScormRuntimeSnapshot', {
    registrationId: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false
    },
    payloadJson: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
        defaultValue: '{}'
    },
    stateVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    initialized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'scorm_runtime_snapshots'
});

module.exports = ScormRuntimeSnapshot;
