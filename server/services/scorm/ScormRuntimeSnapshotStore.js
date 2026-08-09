const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { ScormCmiState } = require('../../models/scorm');

const STATE_KEYS = [
    'attemptId',
    'lessonStatus',
    'scoreRaw',
    'scoreMin',
    'scoreMax',
    'lessonLocation',
    'suspendData',
    'entry',
    'exit',
    'totalTime',
    'sessionTime',
    'interactionsJson',
    'rawMapJson',
    'stateVersion',
    'initialized'
];

let readyPromise = null;

/**
 * Keep the canonical runtime table independent from sequelize.sync().
 *
 * Production deliberately tolerates a failed global sync so the rest of the
 * application can boot against an older database. That behaviour is useful for
 * the application, but it must not leave the SCORM runtime believing its table
 * exists. Create/repair this tiny table explicitly instead of calling
 * Model.sync() from learner requests.
 */
async function ensureReady() {
    if (!readyPromise) {
        readyPromise = (async () => {
            const dialect = sequelize.getDialect();

            if (dialect === 'postgres') {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS "scorm_runtime_snapshots" (
                        "registrationId" UUID PRIMARY KEY,
                        "payloadJson" TEXT NOT NULL DEFAULT '{}',
                        "stateVersion" INTEGER NOT NULL DEFAULT 0,
                        "initialized" BOOLEAN NOT NULL DEFAULT FALSE,
                        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Repair an interrupted/partial earlier creation without relying
                // on Sequelize's alter/sync machinery. A previous deploy may
                // have created the table but failed before all columns or the
                // primary/unique constraint were present.
                const additions = [
                    `ALTER TABLE "scorm_runtime_snapshots" ADD COLUMN IF NOT EXISTS "registrationId" UUID`,
                    `ALTER TABLE "scorm_runtime_snapshots" ADD COLUMN IF NOT EXISTS "payloadJson" TEXT NOT NULL DEFAULT '{}'`,
                    `ALTER TABLE "scorm_runtime_snapshots" ADD COLUMN IF NOT EXISTS "stateVersion" INTEGER NOT NULL DEFAULT 0`,
                    `ALTER TABLE "scorm_runtime_snapshots" ADD COLUMN IF NOT EXISTS "initialized" BOOLEAN NOT NULL DEFAULT FALSE`,
                    `ALTER TABLE "scorm_runtime_snapshots" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
                    `ALTER TABLE "scorm_runtime_snapshots" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`
                ];
                for (const sql of additions) await sequelize.query(sql);

                // Make ON CONFLICT reliable even if an earlier partial table was
                // created without its primary key. Remove only unusable/duplicate
                // snapshot rows; registration data itself is untouched.
                await sequelize.query(`DELETE FROM "scorm_runtime_snapshots" WHERE "registrationId" IS NULL`);
                await sequelize.query(`
                    DELETE FROM "scorm_runtime_snapshots" older
                    USING "scorm_runtime_snapshots" newer
                    WHERE older."registrationId" = newer."registrationId"
                      AND older.ctid < newer.ctid
                `);
                await sequelize.query(`
                    CREATE UNIQUE INDEX IF NOT EXISTS "scorm_runtime_snapshots_registration_id_uq"
                    ON "scorm_runtime_snapshots" ("registrationId")
                `);
            } else if (dialect === 'mysql') {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS \`scorm_runtime_snapshots\` (
                        \`registrationId\` CHAR(36) NOT NULL PRIMARY KEY,
                        \`payloadJson\` LONGTEXT NOT NULL,
                        \`stateVersion\` INTEGER NOT NULL DEFAULT 0,
                        \`initialized\` BOOLEAN NOT NULL DEFAULT FALSE,
                        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            } else {
                await sequelize.query(`
                    CREATE TABLE IF NOT EXISTS \`scorm_runtime_snapshots\` (
                        \`registrationId\` VARCHAR(36) NOT NULL PRIMARY KEY,
                        \`payloadJson\` TEXT NOT NULL DEFAULT '{}',
                        \`stateVersion\` INTEGER NOT NULL DEFAULT 0,
                        \`initialized\` BOOLEAN NOT NULL DEFAULT 0,
                        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            }
        })().catch((err) => {
            readyPromise = null;
            throw err;
        });
    }
    await readyPromise;
}

function defaultState() {
    return {
        attemptId: null,
        lessonStatus: 'not attempted',
        scoreRaw: null,
        scoreMin: null,
        scoreMax: null,
        lessonLocation: null,
        suspendData: '',
        entry: 'ab-initio',
        exit: '',
        totalTime: '00:00:00.00',
        sessionTime: '00:00:00.00',
        interactionsJson: null,
        rawMapJson: '{}',
        stateVersion: 0,
        initialized: false
    };
}

function plain(value) {
    if (!value) return null;
    return typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function normalizeState(value) {
    const source = plain(value) || {};
    const state = defaultState();
    for (const key of STATE_KEYS) {
        if (source[key] !== undefined && source[key] !== null) state[key] = source[key];
    }
    state.stateVersion = Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : 0;
    state.initialized = !!state.initialized;
    state.rawMapJson = typeof state.rawMapJson === 'string' && state.rawMapJson ? state.rawMapJson : '{}';
    state.suspendData = typeof state.suspendData === 'string' ? state.suspendData : '';
    state.totalTime = typeof state.totalTime === 'string' && state.totalTime ? state.totalTime : '00:00:00.00';
    state.sessionTime = typeof state.sessionTime === 'string' && state.sessionTime ? state.sessionTime : '00:00:00.00';
    return state;
}

function payloadFromSnapshot(snapshot) {
    const row = plain(snapshot);
    if (!row) return null;
    try {
        const parsed = typeof row.payloadJson === 'string' ? JSON.parse(row.payloadJson) : row.payloadJson;
        return normalizeState({
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
            stateVersion: row.stateVersion ?? parsed?.stateVersion,
            initialized: row.initialized ?? parsed?.initialized
        });
    } catch (_) {
        return null;
    }
}

async function readSnapshot(registrationId) {
    await ensureReady();
    const dialect = sequelize.getDialect();
    const quotedTable = dialect === 'postgres' ? '"scorm_runtime_snapshots"' : '`scorm_runtime_snapshots`';
    const quotedId = dialect === 'postgres' ? '"registrationId"' : '`registrationId`';
    const rows = await sequelize.query(
        `SELECT * FROM ${quotedTable} WHERE ${quotedId} = :registrationId LIMIT 1`,
        {
            replacements: { registrationId },
            type: QueryTypes.SELECT
        }
    );
    return rows[0] || null;
}

async function writeSnapshot(registrationId, state, options = {}) {
    await ensureReady();
    const normalized = normalizeState(state);
    const payloadJson = JSON.stringify(normalized);
    const replacements = {
        registrationId,
        payloadJson,
        stateVersion: normalized.stateVersion,
        initialized: normalized.initialized
    };
    const queryOptions = { replacements };
    if (options.transaction) queryOptions.transaction = options.transaction;

    const dialect = sequelize.getDialect();
    if (dialect === 'postgres') {
        await sequelize.query(`
            INSERT INTO "scorm_runtime_snapshots"
                ("registrationId", "payloadJson", "stateVersion", "initialized", "createdAt", "updatedAt")
            VALUES
                (:registrationId, :payloadJson, :stateVersion, :initialized, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("registrationId") DO UPDATE SET
                "payloadJson" = EXCLUDED."payloadJson",
                "stateVersion" = EXCLUDED."stateVersion",
                "initialized" = EXCLUDED."initialized",
                "updatedAt" = CURRENT_TIMESTAMP
        `, queryOptions);
    } else if (dialect === 'mysql') {
        await sequelize.query(`
            INSERT INTO \`scorm_runtime_snapshots\`
                (\`registrationId\`, \`payloadJson\`, \`stateVersion\`, \`initialized\`, \`createdAt\`, \`updatedAt\`)
            VALUES
                (:registrationId, :payloadJson, :stateVersion, :initialized, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                \`payloadJson\` = VALUES(\`payloadJson\`),
                \`stateVersion\` = VALUES(\`stateVersion\`),
                \`initialized\` = VALUES(\`initialized\`),
                \`updatedAt\` = CURRENT_TIMESTAMP
        `, queryOptions);
    } else {
        await sequelize.query(`
            INSERT INTO \`scorm_runtime_snapshots\`
                (\`registrationId\`, \`payloadJson\`, \`stateVersion\`, \`initialized\`, \`createdAt\`, \`updatedAt\`)
            VALUES
                (:registrationId, :payloadJson, :stateVersion, :initialized, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(\`registrationId\`) DO UPDATE SET
                \`payloadJson\` = excluded.\`payloadJson\`,
                \`stateVersion\` = excluded.\`stateVersion\`,
                \`initialized\` = excluded.\`initialized\`,
                \`updatedAt\` = CURRENT_TIMESTAMP
        `, queryOptions);
    }
    return normalized;
}

async function load(registrationId) {
    const snapshot = await readSnapshot(registrationId);
    const canonical = payloadFromSnapshot(snapshot);
    if (canonical) return canonical;

    // One-time migration-on-read. Failure of the historical CMI table is never
    // fatal to the learner runtime.
    let migrated = null;
    try {
        const legacy = await ScormCmiState.findOne({ where: { registrationId } });
        if (legacy) migrated = normalizeState(legacy);
    } catch (err) {
        console.warn('[scorm-runtime] legacy state read skipped', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
    }

    return writeSnapshot(registrationId, migrated || defaultState());
}

async function projectLegacy(registrationId, state) {
    const normalized = normalizeState(state);
    try {
        let legacy = await ScormCmiState.findOne({ where: { registrationId } });
        if (!legacy) legacy = ScormCmiState.build({ registrationId });
        for (const key of STATE_KEYS) legacy[key] = normalized[key];
        await legacy.save();
        return true;
    } catch (err) {
        console.warn('[scorm-runtime] legacy CMI projection failed', {
            registrationId,
            error: err?.message || String(err),
            dbCode: err?.original?.code || err?.parent?.code || null
        });
        return false;
    }
}

function queueLegacyProjection(registrationId, state) {
    const copy = normalizeState(state);
    setImmediate(() => {
        projectLegacy(registrationId, copy).catch(() => {});
    });
}

async function save(registrationId, state, options = {}) {
    const normalized = await writeSnapshot(registrationId, state, options);
    if (options.projectLegacy !== false) queueLegacyProjection(registrationId, normalized);
    return normalized;
}

async function destroy(registrationId, options = {}) {
    await ensureReady();
    const dialect = sequelize.getDialect();
    const quotedTable = dialect === 'postgres' ? '"scorm_runtime_snapshots"' : '`scorm_runtime_snapshots`';
    const quotedId = dialect === 'postgres' ? '"registrationId"' : '`registrationId`';
    const queryOptions = { replacements: { registrationId } };
    if (options.transaction) queryOptions.transaction = options.transaction;
    await sequelize.query(
        `DELETE FROM ${quotedTable} WHERE ${quotedId} = :registrationId`,
        queryOptions
    );
}

function snapshotState(snapshot) {
    return payloadFromSnapshot(snapshot);
}

function resetReadyForTests() {
    readyPromise = null;
}

module.exports = {
    ensureReady,
    defaultState,
    normalizeState,
    snapshotState,
    load,
    save,
    destroy,
    projectLegacy,
    resetReadyForTests,
    STATE_KEYS
};
