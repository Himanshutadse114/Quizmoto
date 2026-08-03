/**
 * Phase 3 (P3-T08) — structured JSON logging.
 *
 * Emits one JSON object per line to stdout/stderr for easy ingestion.
 * Safe to use from HTTP middleware, socket paths, and job workers.
 *
 * Levels: debug | info | warn | error
 * Env: LOG_LEVEL=debug|info|warn|error (default info)
 *      LOG_FORMAT=json|text (default json in production, text otherwise unless forced)
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function resolveMinLevel() {
    const raw = (process.env.LOG_LEVEL || 'info').toLowerCase();
    return LEVELS[raw] != null ? LEVELS[raw] : LEVELS.info;
}

function useJson() {
    if (process.env.LOG_FORMAT === 'text') return false;
    if (process.env.LOG_FORMAT === 'json') return true;
    return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test';
}

function baseFields() {
    return {
        timestamp: new Date().toISOString(),
        service: process.env.LOG_SERVICE || 'quizmoto-server',
        env: process.env.NODE_ENV || 'development'
    };
}

function emit(level, message, fields) {
    const min = resolveMinLevel();
    const lvl = LEVELS[level] != null ? LEVELS[level] : LEVELS.info;
    if (lvl < min) return;

    const payload = {
        ...baseFields(),
        level,
        message: message != null ? String(message) : '',
        ...(fields && typeof fields === 'object' ? fields : {})
    };

    const line = useJson()
        ? JSON.stringify(payload)
        : `[${payload.timestamp}] ${level.toUpperCase()} ${payload.message}` +
          (fields && Object.keys(fields).length
              ? ' ' + JSON.stringify(fields)
              : '');

    if (level === 'error') {
        console.error(line);
    } else if (level === 'warn') {
        console.warn(line);
    } else {
        console.log(line);
    }
}

const logger = {
    debug(message, fields) {
        emit('debug', message, fields);
    },
    info(message, fields) {
        emit('info', message, fields);
    },
    warn(message, fields) {
        emit('warn', message, fields);
    },
    error(message, fields) {
        emit('error', message, fields);
    },

    /** HTTP access line */
    http(req, res, durationMs) {
        emit('info', 'http_request', {
            module: 'http',
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs,
            requestId: req.requestId || undefined
        });
    },

    /** Job lifecycle */
    job(event, fields) {
        emit(event === 'job_failed' ? 'error' : 'info', event, {
            module: 'jobs',
            ...fields
        });
    },

    /** Socket / session diagnostic (compatible with existing logDiag shape) */
    socket(event, fields) {
        emit('info', event, {
            module: 'socket',
            ...fields
        });
    }
};

module.exports = logger;
