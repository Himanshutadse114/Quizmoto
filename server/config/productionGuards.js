/**
 * Phase 3 production posture guards.
 * Fail fast on unsafe production configuration.
 */

/**
 * Ensure production never silently uses SQLite.
 * @param {Object} [env=process.env]
 * @throws {Error} when production dialect is missing or sqlite
 */
function assertProductionDatabase(env = process.env) {
    const nodeEnv = String(env.NODE_ENV || '').toLowerCase();
    if (nodeEnv !== 'production') {
        return { ok: true, skipped: true, reason: 'NOT_PRODUCTION' };
    }

    const dialect = String(env.DB_DIALECT || '').toLowerCase();
    if (!dialect) {
        const err = new Error(
            'Production requires DB_DIALECT=postgres (or mysql). SQLite is not allowed in production.'
        );
        err.code = 'PROD_DB_DIALECT_MISSING';
        throw err;
    }
    if (dialect === 'sqlite') {
        const err = new Error(
            'Production refuses DB_DIALECT=sqlite. Set DB_DIALECT=postgres for production.'
        );
        err.code = 'PROD_DB_SQLITE_FORBIDDEN';
        throw err;
    }
    if (dialect !== 'postgres' && dialect !== 'postgresql' && dialect !== 'mysql') {
        const err = new Error(
            `Production DB_DIALECT="${dialect}" is not supported. Use postgres (recommended) or mysql.`
        );
        err.code = 'PROD_DB_DIALECT_UNSUPPORTED';
        throw err;
    }

    return { ok: true, dialect };
}

module.exports = {
    assertProductionDatabase
};
