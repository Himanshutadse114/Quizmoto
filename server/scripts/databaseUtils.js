const { spawn } = require('child_process');

function decodeUrlPart(value, label) {
    try {
        return decodeURIComponent(value || '');
    } catch {
        throw new Error(`Invalid percent-encoding in database ${label}.`);
    }
}

function parseDatabaseUrl(value) {
    let parsed;
    try {
        parsed = new URL(String(value || ''));
    } catch {
        throw new Error('DATABASE_URL is not a valid PostgreSQL URL.');
    }
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
        throw new Error('DATABASE_URL must use the postgres:// or postgresql:// protocol.');
    }
    const database = decodeUrlPart(parsed.pathname.replace(/^\//, ''), 'name');
    const config = {
        host: parsed.hostname,
        port: parsed.port || '5432',
        database,
        user: decodeUrlPart(parsed.username, 'username'),
        password: decodeUrlPart(parsed.password, 'password'),
        sslMode: parsed.searchParams.get('sslmode') || 'require'
    };
    for (const [key, item] of Object.entries(config)) {
        if (key !== 'password' && !String(item || '').trim()) {
            throw new Error(`DATABASE_URL is missing the database ${key}.`);
        }
    }
    return config;
}

function databaseConfigFromEnv(env = process.env, options = {}) {
    const urlKey = options.urlKey || 'DATABASE_URL';
    const prefix = options.prefix || 'DB_';
    if (env[urlKey]) return parseDatabaseUrl(env[urlKey]);

    const config = {
        host: env[`${prefix}HOST`],
        port: env[`${prefix}PORT`] || '5432',
        database: env[`${prefix}NAME`],
        user: env[`${prefix}USER`],
        password: env[`${prefix}PASS`] || '',
        sslMode: String(env[`${prefix}SSL`] || 'true').toLowerCase() === 'false' ? 'disable' : 'require'
    };
    for (const key of ['host', 'port', 'database', 'user']) {
        if (!String(config[key] || '').trim()) {
            throw new Error(`Set ${urlKey} or ${prefix}${key === 'database' ? 'NAME' : key.toUpperCase()}.`);
        }
    }
    return config;
}

function postgresProcessEnv(config, baseEnv = process.env) {
    return {
        ...baseEnv,
        PGHOST: config.host,
        PGPORT: String(config.port || 5432),
        PGDATABASE: config.database,
        PGUSER: config.user,
        PGPASSWORD: config.password || '',
        PGSSLMODE: config.sslMode || 'require',
        PGCONNECT_TIMEOUT: baseEnv.PGCONNECT_TIMEOUT || '20',
        PGOPTIONS: baseEnv.PGOPTIONS || '-c statement_timeout=0'
    };
}

function runCommand(command, args, options = {}) {
    const capture = Boolean(options.capture);
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            env: options.env || process.env,
            cwd: options.cwd,
            windowsHide: true,
            stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit']
        });
        const stdout = [];
        const stderr = [];
        if (capture) {
            child.stdout.on('data', (chunk) => stdout.push(chunk));
            child.stderr.on('data', (chunk) => stderr.push(chunk));
        }
        child.once('error', (error) => reject(new Error(`Unable to start ${command}: ${error.message}`)));
        child.once('close', (code) => {
            const result = {
                code,
                stdout: Buffer.concat(stdout).toString('utf8'),
                stderr: Buffer.concat(stderr).toString('utf8')
            };
            if (code === 0) return resolve(result);
            const detail = result.stderr.trim();
            return reject(new Error(`${command} exited with code ${code}${detail ? `: ${detail}` : ''}`));
        });
    });
}

module.exports = {
    databaseConfigFromEnv,
    parseDatabaseUrl,
    postgresProcessEnv,
    runCommand
};
