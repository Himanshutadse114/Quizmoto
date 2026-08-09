const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

let ensured = false;
let ensurePromise = null;

async function ensureColumns(tableName, definitions) {
    const qi = sequelize.getQueryInterface();
    const current = await qi.describeTable(tableName);
    for (const [column, definition] of Object.entries(definitions)) {
        if (current[column]) continue;
        await qi.addColumn(tableName, column, definition);
    }
}

async function runEnsure() {
    await ensureColumns('scorm_registrations', {
        isPreview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        lastLessonStatus: { type: DataTypes.STRING, allowNull: true },
        lastScoreRaw: { type: DataTypes.FLOAT, allowNull: true },
        lastTotalTime: { type: DataTypes.STRING, allowNull: true },
        lastCommitAt: { type: DataTypes.DATE, allowNull: true }
    });

    await ensureColumns('scorm_cmi_states', {
        attemptId: { type: DataTypes.UUID, allowNull: true },
        lessonStatus: { type: DataTypes.STRING, allowNull: true, defaultValue: 'not attempted' },
        scoreRaw: { type: DataTypes.FLOAT, allowNull: true },
        scoreMin: { type: DataTypes.FLOAT, allowNull: true },
        scoreMax: { type: DataTypes.FLOAT, allowNull: true },
        lessonLocation: { type: DataTypes.TEXT, allowNull: true },
        suspendData: { type: DataTypes.TEXT, allowNull: true },
        entry: { type: DataTypes.STRING, allowNull: true },
        exit: { type: DataTypes.STRING, allowNull: true },
        totalTime: { type: DataTypes.STRING, allowNull: true, defaultValue: '00:00:00.00' },
        sessionTime: { type: DataTypes.STRING, allowNull: true, defaultValue: '00:00:00.00' },
        interactionsJson: { type: DataTypes.TEXT, allowNull: true },
        rawMapJson: { type: DataTypes.TEXT, allowNull: true },
        stateVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        initialized: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    });

    await ensureColumns('scorm_attempts', {
        exitType: { type: DataTypes.STRING, allowNull: true }
    });
}

async function ensureScormRuntimeSchema() {
    if (ensured) return;
    if (!ensurePromise) {
        ensurePromise = runEnsure()
            .then(() => {
                ensured = true;
            })
            .finally(() => {
                ensurePromise = null;
            });
    }
    await ensurePromise;
}

function resetScormRuntimeSchemaGuardForTests() {
    ensured = false;
    ensurePromise = null;
}

module.exports = {
    ensureScormRuntimeSchema,
    resetScormRuntimeSchemaGuardForTests
};
