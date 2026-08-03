/**
 * Phase 3 background worker entrypoint.
 *
 * Usage:
 *   node worker.js
 *   npm run worker
 *
 * Requires nothing for memory-backend processing of enqueued jobs in-process tests.
 * Set REDIS_URL for multi-process queue sharing with the API.
 *
 * Does NOT start HTTP or Socket.IO — live play stays on index.js.
 */

if (process.env.NODE_ENV === 'test') {
    require('dotenv').config({ path: '.env.test' });
} else {
    require('dotenv').config();
}

const JobQueueService = require('./jobs/JobQueueService');
const { registerReportHandlers } = require('./jobs/handlers/reportHandlers');

registerReportHandlers();

let stopping = false;

function requestStop() {
    if (stopping) return;
    stopping = true;
    console.log('[worker] shutdown requested');
}

process.on('SIGINT', requestStop);
process.on('SIGTERM', requestStop);

(async () => {
    console.log('[worker] Quizmoto job worker starting');
    console.log(`[worker] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    console.log(`[worker] REDIS_URL=${process.env.REDIS_URL ? 'set' : 'not set (memory queue)'}`);

    await JobQueueService.runWorkerLoop({
        stopFn: () => stopping,
        idleMs: Number(process.env.WORKER_IDLE_MS) || 500
    });

    process.exit(0);
})().catch((err) => {
    console.error('[worker] fatal:', err);
    process.exit(1);
});
