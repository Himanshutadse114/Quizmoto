/**
 * Phase 3 report job handlers — generation + object storage.
 * Never touches live session sockets.
 */

const fs = require('fs');
const path = require('path');
const { JOB_TYPES } = require('../jobTypes');
const JobQueueService = require('../JobQueueService');
const ReportGenerationService = require('../../services/ReportGenerationService');
const { getObjectStorage } = require('../../storage/ObjectStorage');

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

    const generated = await ReportGenerationService.generateReportFile({
        sessionId,
        hostId,
        format,
        testRunId,
        keepFiles: true
    });

    const storage = getObjectStorage();
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const storageKey = `reports/${sessionId}/${job.id}.${ext}`;

    const body = fs.readFileSync(generated.outputPath);
    await storage.putObject({
        key: storageKey,
        body,
        contentType: generated.contentType
    });

    // Prefer storage key; keep local path only for local driver convenience
    const localPath = storage.resolveLocalPath
        ? storage.resolveLocalPath(storageKey)
        : null;

    // Clean temp generation files (artifact lives in storage)
    ReportGenerationService.safeUnlink(generated.outputPath);
    ReportGenerationService.safeUnlink(generated.jsonPath);

    return {
        ok: true,
        sessionId,
        format,
        storageKey,
        artifactPath: localPath || generated.outputPath,
        contentType: generated.contentType,
        downloadName: generated.downloadName
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
