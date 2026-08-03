/**
 * Phase 3 report job handlers — real generation via ReportGenerationService.
 * Never touches live session sockets.
 */

const { JOB_TYPES } = require('../jobTypes');
const JobQueueService = require('../JobQueueService');
const ReportGenerationService = require('../../services/ReportGenerationService');

async function handleReportJob(payload, job) {
    const sessionId = payload && payload.sessionId;
    const hostId = payload && payload.hostId;
    const format =
        (payload && payload.format) ||
        (job.type === JOB_TYPES.REPORT_EXCEL ? 'excel' : 'pdf');
    const testRunId = (payload && payload.testRunId) || null;

    if (!sessionId) {
        throw new Error('sessionId is required in report job payload');
    }
    if (hostId == null) {
        throw new Error('hostId is required in report job payload');
    }

    const result = await ReportGenerationService.generateReportFile({
        sessionId,
        hostId,
        format,
        testRunId,
        keepFiles: true // worker keeps artifact for download
    });

    return {
        ok: true,
        sessionId,
        format,
        artifactPath: result.outputPath,
        contentType: result.contentType,
        downloadName: result.downloadName
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
