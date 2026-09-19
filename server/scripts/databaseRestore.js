const fs = require('fs');
const path = require('path');
const {
    databaseConfigFromEnv,
    postgresProcessEnv,
    runCommand
} = require('./databaseUtils');

async function main(env = process.env) {
    if (env.CONFIRM_DATABASE_RESTORE !== 'RESTORE') {
        throw new Error('Set CONFIRM_DATABASE_RESTORE=RESTORE after checking the target database.');
    }
    const archive = path.resolve(String(env.DATABASE_BACKUP_FILE || ''));
    if (!archive || !fs.existsSync(archive) || !fs.statSync(archive).isFile()) {
        throw new Error('DATABASE_BACKUP_FILE must point to an existing .dump archive.');
    }
    const target = databaseConfigFromEnv(env, {
        urlKey: 'RESTORE_DATABASE_URL',
        prefix: 'RESTORE_DB_'
    });
    const pgEnv = postgresProcessEnv(target, env);
    const pgRestore = env.PG_RESTORE_PATH || 'pg_restore';

    console.log(`Validating ${path.basename(archive)}...`);
    const validation = await runCommand(pgRestore, ['--list', archive], { env: pgEnv, capture: true });
    const archiveObjects = validation.stdout.split(/\r?\n/).filter((line) => /^\d+;/.test(line)).length;
    if (!archiveObjects) throw new Error('The backup archive contains no restorable objects.');
    console.log(`Restoring ${archiveObjects} archive objects into the selected target database...`);
    await runCommand(pgRestore, [
        '--no-owner',
        '--no-privileges',
        '--clean',
        '--if-exists',
        '--exit-on-error',
        '--dbname', target.database,
        archive
    ], { env: pgEnv });
    console.log('Database restore completed successfully.');
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`Database restore failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { main };
