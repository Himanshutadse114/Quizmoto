const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const { getObjectStorage } = require('../../storage/ObjectStorage');

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_MS = 10000;

let cachedHealth = null;
let cachedAt = 0;

function withTimeout(task, timeoutMs, code) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error('Infrastructure health check timed out.');
            error.code = code;
            reject(error);
        }, timeoutMs);
        timer.unref?.();
    });

    return Promise.race([Promise.resolve().then(task), timeout])
        .finally(() => clearTimeout(timer));
}

async function checkDependency({ task, timeoutMs, timeoutCode, failureMessage }) {
    const startedAt = Date.now();
    try {
        await withTimeout(task, timeoutMs, timeoutCode);
        return {
            status: 'connected',
            latencyMs: Math.max(0, Date.now() - startedAt),
            message: 'Connected'
        };
    } catch (error) {
        console.error('[infrastructure-health] dependency check failed', {
            dependency: timeoutCode === 'DATABASE_HEALTH_TIMEOUT' ? 'database' : 'object-storage',
            code: error?.code || error?.name || 'UNKNOWN'
        });
        return {
            status: 'error',
            latencyMs: Math.max(0, Date.now() - startedAt),
            message: failureMessage
        };
    }
}

async function runInfrastructureHealthCheck(options = {}) {
    const database = options.sequelize || sequelize;
    const storageFactory = options.getObjectStorage || getObjectStorage;
    const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);

    const databasePromise = checkDependency({
        timeoutMs,
        timeoutCode: 'DATABASE_HEALTH_TIMEOUT',
        failureMessage: 'Connection unavailable',
        task: () => database.query('SELECT 1 AS ok', { type: QueryTypes.SELECT })
    });

    let objectStoragePromise;
    try {
        const storage = storageFactory();
        if (storage?.driver !== 's3') {
            objectStoragePromise = Promise.resolve({
                status: 'not_configured',
                latencyMs: null,
                message: 'R2 is not configured'
            });
        } else {
            objectStoragePromise = checkDependency({
                timeoutMs,
                timeoutCode: 'OBJECT_STORAGE_HEALTH_TIMEOUT',
                failureMessage: 'Connection unavailable',
                task: () => storage.listKeys('health-check/', { maxKeys: 1 })
            });
        }
    } catch (error) {
        console.error('[infrastructure-health] object storage initialization failed', {
            code: error?.code || error?.name || 'UNKNOWN'
        });
        objectStoragePromise = Promise.resolve({
            status: 'error',
            latencyMs: null,
            message: 'Connection unavailable'
        });
    }

    const [databaseStatus, objectStorageStatus] = await Promise.all([
        databasePromise,
        objectStoragePromise
    ]);

    return {
        checkedAt: new Date().toISOString(),
        overall: databaseStatus.status === 'connected' && objectStorageStatus.status === 'connected'
            ? 'connected'
            : 'attention',
        database: databaseStatus,
        objectStorage: objectStorageStatus
    };
}

async function getInfrastructureHealth(options = {}) {
    const now = Date.now();
    const cacheMs = Number(options.cacheMs ?? DEFAULT_CACHE_MS);
    if (!options.force && cachedHealth && now - cachedAt < cacheMs) {
        return cachedHealth;
    }

    const health = await runInfrastructureHealthCheck(options);
    cachedHealth = health;
    cachedAt = now;
    return health;
}

function resetInfrastructureHealthCache() {
    cachedHealth = null;
    cachedAt = 0;
}

module.exports = {
    getInfrastructureHealth,
    runInfrastructureHealthCheck,
    resetInfrastructureHealthCache
};
