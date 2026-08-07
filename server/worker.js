/**
 * Phase 3 background worker entrypoint.
 *
 * Usage:
 *   node worker.js
 *   npm run worker
 */

if (process.env.NODE_ENV === 'test') {
    require('dotenv').config({ path: '.env.test' });
} else {
    require('dotenv').config();
}

const logger = require('./utils/logger');
const JobQueueService = require('./jobs/JobQueueService');
const { registerReportHandlers } = require('./jobs/handlers/reportHandlers');

registerReportHandlers();

try {
    const { registerScormHandlers } = require('./jobs/handlers/scormHandlers');
    registerScormHandlers();
} catch (e) {
    logger.warn('scorm_handlers_not_registered', { module: 'worker', error: e.message });
}

let stopping = false;

function requestStop() {
    if (stopping) return;
    stopping = true;
    logger.info('worker_shutdown_requested', { module: 'worker' });
}

process.on('SIGINT', requestStop);
process.on('SIGTERM', requestStop);

(async () => {
    logger.info('worker_starting', {
        module: 'worker',
        nodeEnv: process.env.NODE_ENV || 'development',
        redis: process.env.REDIS_URL ? 'set' : 'memory'
    });

    await JobQueueService.runWorkerLoop({
        stopFn: () => stopping,
        idleMs: Number(process.env.WORKER_IDLE_MS) || 500
    });

    logger.info('worker_stopped', { module: 'worker' });
    process.exit(0);
})().catch((err) => {
    logger.error('worker_fatal', { module: 'worker', error: err.message, stack: err.stack });
    process.exit(1);
});
