const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const RuntimeStore = require('./ScormRuntimeSnapshotStore');

async function listByRegistrationIds(registrationIds) {
    const ids = Array.from(new Set((registrationIds || []).filter(Boolean).map(String)));
    const out = new Map();
    if (!ids.length) return out;

    try {
        await RuntimeStore.ensureReady();
    } catch (err) {
        console.warn('[scorm-runtime] snapshot reader ensureReady failed', { error: err?.message || String(err) });
        return out;
    }

    const dialect = sequelize.getDialect();
    const quotedTable = dialect === 'postgres' ? '"scorm_runtime_snapshots"' : '`scorm_runtime_snapshots`';
    const quotedId = dialect === 'postgres' ? '"registrationId"' : '`registrationId`';

    let rows = [];
    try {
        rows = await sequelize.query(
            `SELECT * FROM ${quotedTable} WHERE ${quotedId} IN (:registrationIds)`,
            {
                replacements: { registrationIds: ids },
                type: QueryTypes.SELECT
            }
        );
    } catch (err) {
        console.warn('[scorm-runtime] snapshot list failed', {
            registrations: ids.length,
            error: err?.message || String(err)
        });
        return out;
    }

    for (const row of rows) {
        const state = RuntimeStore.snapshotState(row);
        const id = String(row.registrationId || row.registrationid || '');
        if (state && id) out.set(id, state);
    }
    return out;
}

module.exports = { listByRegistrationIds };
