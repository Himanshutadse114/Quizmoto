/**
 * Shared report generation (PDF / Excel).
 * Used by sync HTTP path and by Phase 3 background workers.
 * Never touches Socket.IO or live session state.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');

const execFileAsync = promisify(execFile);

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function resolvePythonCmd() {
    if (process.env.TEST_PYTHON_FAIL) return 'invalid_python_cmd_xyz';
    return process.platform === 'win32' ? 'python' : 'python3';
}

function artifactsDir(testRunId) {
    if (process.env.REPORT_ARTIFACTS_DIR) {
        ensureDir(process.env.REPORT_ARTIFACTS_DIR);
        return process.env.REPORT_ARTIFACTS_DIR;
    }
    const tmpRoot = process.env.TEST_TEMP_DIR_ROOT || path.join(__dirname, '../data/tmp');
    if (process.env.NODE_ENV === 'test' && testRunId) {
        const dir = path.join(tmpRoot, `test_${testRunId}`);
        ensureDir(dir);
        return dir;
    }
    const dir = path.join(__dirname, '../data/artifacts');
    ensureDir(dir);
    return dir;
}

/**
 * Load a finished (or any) session owned by host for export.
 */
async function loadSessionForExport(sessionId, hostId) {
    const session = await GameSession.findOne({
        where: { id: sessionId, hostId },
        include: [
            {
                model: Player,
                as: 'players',
                include: [{ model: PlayerAnswer, as: 'answers' }]
            },
            {
                model: Quiz,
                attributes: ['title'],
                include: [{ model: Question, as: 'questions' }]
            }
        ]
    });
    return session;
}

/**
 * Generate a report file for a session.
 * @returns {Promise<{ outputPath: string, jsonPath: string, format: string, contentType: string, downloadName: string }>}
 */
async function generateReportFile({
    sessionId,
    hostId,
    format = 'pdf',
    testRunId = null,
    keepFiles = false
}) {
    if (!['pdf', 'excel'].includes(format)) {
        const err = new Error('Invalid format');
        err.code = 'INVALID_FORMAT';
        throw err;
    }

    const session = await loadSessionForExport(sessionId, hostId);
    if (!session) {
        const err = new Error('Session not found');
        err.code = 'SESSION_NOT_FOUND';
        throw err;
    }

    const dir = artifactsDir(testRunId);
    const timestamp = Date.now();
    const jsonPath = path.join(dir, `report_${session.id}_${timestamp}.json`);
    const ext = format === 'pdf' ? '.pdf' : '.xlsx';
    const outputPath = path.join(dir, `report_${session.id}_${timestamp}${ext}`);

    fs.writeFileSync(jsonPath, JSON.stringify(session.toJSON()));

    const scriptPath = path.join(__dirname, '../utils/generate_report.py');
    const pyCmd = resolvePythonCmd();

    try {
        await execFileAsync(pyCmd, [scriptPath, jsonPath, outputPath, format], {
            timeout: Number(process.env.REPORT_GEN_TIMEOUT_MS) || 60000,
            windowsHide: true
        });
    } catch (err) {
        if (fs.existsSync(jsonPath) && !keepFiles) {
            try {
                fs.unlinkSync(jsonPath);
            } catch (_) {
                /* ignore */
            }
        }
        const wrapped = new Error('Report generation failed');
        wrapped.code = 'REPORT_GEN_FAILED';
        wrapped.cause = err;
        throw wrapped;
    }

    if (!fs.existsSync(outputPath)) {
        if (fs.existsSync(jsonPath) && !keepFiles) fs.unlinkSync(jsonPath);
        const err = new Error('Report generation failed');
        err.code = 'REPORT_GEN_FAILED';
        throw err;
    }

    if (!keepFiles && fs.existsSync(jsonPath)) {
        try {
            fs.unlinkSync(jsonPath);
        } catch (_) {
            /* ignore */
        }
    }

    return {
        outputPath,
        jsonPath,
        format,
        contentType:
            format === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        downloadName: `Report${ext}`
    };
}

function safeUnlink(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {
        /* ignore */
    }
}

module.exports = {
    loadSessionForExport,
    generateReportFile,
    safeUnlink,
    artifactsDir
};
