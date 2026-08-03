/**
 * Phase 3 report job handlers (foundation stubs).
 * Full Python export wiring lands in P3-T05.
 * Handlers must be side-effect safe and never touch live session sockets.
 */

const path = require('path');
const fs = require('fs');
const { JOB_TYPES } = require('../jobTypes');
const JobQueueService = require('../JobQueueService');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Placeholder: validates payload and records intent.
 * P3-T05 will invoke generate_report.py / Excel path here.
 */
async function handleReportJob(payload, job) {
    const sessionId = payload && payload.sessionId;
    const format = (payload && payload.format) || (job.type === JOB_TYPES.REPORT_EXCEL ? 'excel' : 'pdf');

    if (!sessionId) {
        throw new Error('sessionId is required in report job payload');
    }

    const artifactsRoot =
        process.env.REPORT_ARTIFACTS_DIR ||
        path.join(__dirname, '../../data/artifacts');
    ensureDir(artifactsRoot);

    // Foundation: do not run Python yet — mark as accepted skeleton result.
    // T05 replaces this with real generation and storage path.
    return {
        ok: true,
        sessionId,
        format,
        artifactPath: null,
        note: 'handler_stub_pending_P3_T05'
    };
}

function registerReportHandlers() {
    JobQueueService.registerHandler(JOB_TYPES.REPORT_PDF, handleReportJob);
    JobQueueService.registerHandler(JOB_TYPES.REPORT_EXCEL, handleReportJob);
}

module.exports = {
    handleReportJob,
    registerReportHandlers
};
