const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand
} = require('@aws-sdk/client-s3');
const {
    databaseConfigFromEnv,
    postgresProcessEnv,
    runCommand
} = require('./databaseUtils');

const DAY_MS = 24 * 60 * 60 * 1000;

function requiredEnv(env, name) {
    const value = String(env[name] || '').trim();
    if (!value) throw new Error(`${name} is required.`);
    return value;
}

function safePrefix(value) {
    const normalized = String(value || 'database-backups/lmsgen/daily').replace(/^\/+|\/+$/g, '');
    if (!normalized || !/^[a-zA-Z0-9/_-]+$/.test(normalized) || normalized.includes('..')) {
        throw new Error('DB_BACKUP_PREFIX contains unsupported characters.');
    }
    return normalized;
}

function backupName(now = new Date()) {
    return `lmsgen-public-${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}.dump`;
}

function backupKey(prefix, filename, now = new Date()) {
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${safePrefix(prefix)}/${year}/${month}/${filename}`;
}

async function sha256File(filename) {
    const hash = crypto.createHash('sha256');
    await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filename);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.once('error', reject);
        stream.once('end', resolve);
    });
    return hash.digest('hex');
}

function retentionKeys(objects, options = {}) {
    const nowMs = Number(options.nowMs || Date.now());
    const retentionDays = Math.max(1, Number(options.retentionDays || 7));
    const minimumBackups = Math.max(1, Number(options.minimumBackups || 7));
    const dumps = (objects || [])
        .filter((object) => String(object.Key || '').endsWith('.dump'))
        .map((object) => ({ ...object, modifiedMs: new Date(object.LastModified || 0).getTime() }))
        .filter((object) => Number.isFinite(object.modifiedMs))
        .sort((a, b) => b.modifiedMs - a.modifiedMs);
    const cutoff = nowMs - retentionDays * DAY_MS;
    const expired = dumps.filter((object, index) => index >= minimumBackups && object.modifiedMs < cutoff);
    const available = new Set((objects || []).map((object) => object.Key));
    const keys = [];
    for (const object of expired) {
        keys.push(object.Key);
        const manifestKey = object.Key.replace(/\.dump$/, '.manifest.json');
        if (available.has(manifestKey)) keys.push(manifestKey);
    }
    return keys;
}

async function listObjects(client, bucket, prefix) {
    const objects = [];
    let continuationToken;
    do {
        const response = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: `${safePrefix(prefix)}/`,
            ContinuationToken: continuationToken
        }));
        objects.push(...(response.Contents || []));
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
    return objects;
}

async function removeExpiredBackups(client, bucket, prefix, options) {
    const objects = await listObjects(client, bucket, prefix);
    const keys = retentionKeys(objects, options);
    for (let index = 0; index < keys.length; index += 1000) {
        const chunk = keys.slice(index, index + 1000);
        await client.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true }
        }));
    }
    return keys.length;
}

function createR2Client(env = process.env) {
    return new S3Client({
        region: env.S3_REGION || 'auto',
        endpoint: requiredEnv(env, 'S3_ENDPOINT'),
        forcePathStyle: env.S3_FORCE_PATH_STYLE !== '0',
        credentials: {
            accessKeyId: requiredEnv(env, 'AWS_ACCESS_KEY_ID'),
            secretAccessKey: requiredEnv(env, 'AWS_SECRET_ACCESS_KEY')
        }
    });
}

async function main(env = process.env) {
    const bucket = requiredEnv(env, 'S3_BUCKET');
    const prefix = safePrefix(env.DB_BACKUP_PREFIX);
    const retentionDays = Math.max(1, Number(env.DB_BACKUP_RETENTION_DAYS || 7));
    const minimumBackups = Math.max(1, Number(env.DB_BACKUP_MINIMUM_COUNT || 7));
    const pgDump = env.PG_DUMP_PATH || 'pg_dump';
    const pgRestore = env.PG_RESTORE_PATH || 'pg_restore';
    const psql = env.PSQL_PATH || 'psql';
    const databaseConfig = databaseConfigFromEnv(env);
    const pgEnv = postgresProcessEnv(databaseConfig, env);
    const now = new Date();
    const filename = backupName(now);
    const objectKey = backupKey(prefix, filename, now);
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lmsgen-db-backup-'));
    const dumpPath = path.join(tempDir, filename);
    const client = createR2Client(env);

    try {
        const sizeResult = await runCommand(psql, [
            '--no-psqlrc',
            '--tuples-only',
            '--no-align',
            '--command',
            'SELECT pg_database_size(current_database());'
        ], { env: pgEnv, capture: true });
        const databaseSizeBytes = Number(sizeResult.stdout.trim());
        if (!Number.isSafeInteger(databaseSizeBytes) || databaseSizeBytes <= 0) {
            throw new Error('Unable to determine the source database size.');
        }
        const estimatedMonthlySourceEgressBytes = databaseSizeBytes * 31;
        const egressWarningBytes = Math.max(1, Number(env.DB_BACKUP_MONTHLY_EGRESS_WARNING_BYTES || 2 * 1024 ** 3));
        if (estimatedMonthlySourceEgressBytes > egressWarningBytes) {
            console.warn(
                `Daily external backups may transfer about ${estimatedMonthlySourceEgressBytes} bytes per 31 days. ` +
                'Review backup frequency before the workspace bandwidth allowance is affected.'
            );
        }
        console.log(`Creating verified database backup ${filename}...`);
        await runCommand(pgDump, [
            '--schema=public',
            '--format=custom',
            '--compress=9',
            '--no-owner',
            '--no-privileges',
            `--file=${dumpPath}`
        ], { env: pgEnv });

        const stat = await fsp.stat(dumpPath);
        if (stat.size < 100) throw new Error('The generated database archive is unexpectedly small.');
        const validation = await runCommand(pgRestore, ['--list', dumpPath], { env: pgEnv, capture: true });
        const tableDataEntries = validation.stdout.split(/\r?\n/).filter((line) => line.includes(' TABLE DATA ')).length;
        const archiveObjects = validation.stdout.split(/\r?\n/).filter((line) => /^\d+;/.test(line)).length;
        if (archiveObjects === 0) throw new Error('pg_restore could not find objects in the generated archive.');
        const sha256 = await sha256File(dumpPath);
        const manifest = {
            formatVersion: 1,
            createdAt: now.toISOString(),
            objectKey,
            databaseSizeBytes,
            estimatedMonthlySourceEgressBytes,
            sizeBytes: stat.size,
            sha256,
            schema: 'public',
            tableDataEntries,
            archiveObjects,
            postgresClient: 17
        };

        console.log(`Uploading ${objectKey} to R2...`);
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: fs.createReadStream(dumpPath),
            ContentLength: stat.size,
            ContentType: 'application/octet-stream',
            Metadata: { sha256, schema: 'public' }
        }));
        await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey.replace(/\.dump$/, '.manifest.json'),
            Body: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
            ContentType: 'application/json'
        }));

        const removed = await removeExpiredBackups(client, bucket, prefix, {
            retentionDays,
            minimumBackups,
            nowMs: now.getTime()
        });
        console.log(JSON.stringify({ ok: true, ...manifest, expiredObjectsRemoved: removed }));
        return manifest;
    } finally {
        client.destroy();
        await fsp.rm(tempDir, { recursive: true, force: true });
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`Database backup failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    backupKey,
    backupName,
    main,
    retentionKeys,
    safePrefix
};
