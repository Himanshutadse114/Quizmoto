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
const Metrics = require('../utils/metrics');

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
 * Fast path for unit tests — no Python subprocess.
 * Enabled with REPORT_GEN_STUB=1.
 */
function writeStubArtifact(outputPath, format) {
    if (format === 'pdf') {
        fs.writeFileSync(outputPath, Buffer.from('%PDF-1.4\n% stub report\n'));
    } else {
        fs.writeFileSync(outputPath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
    }
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
    const __metricsStart = Date.now();

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

    // Test stub: skip Python entirely (prevents hangs in CI / Windows)
    if (process.env.REPORT_GEN_STUB === '1') {
        writeStubArtifact(outputPath, format);
        if (!keepFiles && fs.existsSync(jsonPath)) {
            try {
                fs.unlinkSync(jsonPath);
            } catch (_) {
                /* ignore */
            }
        }
        Metrics.recordReportLatency(format, Date.now() - __metricsStart);
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

    const scriptPath = path.join(__dirname, '../utils/generate_report.py');
    const pyCmd = resolvePythonCmd();
    const timeoutMs = Number(process.env.REPORT_GEN_TIMEOUT_MS) || 30000;

    // Ensure matplotlib cache dir is writable for non-root (Render USER node)
    const env = {
        ...process.env,
        MPLCONFIGDIR: process.env.MPLCONFIGDIR || path.join(dir, '.mplconfig'),
        PYTHONUNBUFFERED: '1'
    };
    try {
        ensureDir(env.MPLCONFIGDIR);
    } catch (_) {
        /* ignore */
    }

    try {
        const { stdout, stderr } = await execFileAsync(pyCmd, [scriptPath, jsonPath, outputPath, format], {
            timeout: timeoutMs,
            windowsHide: true,
            killSignal: 'SIGTERM',
            env,
            maxBuffer: 5 * 1024 * 1024
        });
        if (stderr && String(stderr).trim()) {
            console.error('[report-gen] python stderr:', String(stderr).slice(0, 2000));
        }
        if (stdout && String(stdout).trim()) {
            console.log('[report-gen] python stdout:', String(stdout).slice(0, 500));
        }
    } catch (err) {
        const stderr = err && (err.stderr || err.message);
        console.error('[report-gen] failed', {
            pyCmd,
            scriptPath,
            format,
            sessionId,
            code: err && err.code,
            signal: err && err.signal,
            stderr: stderr ? String(stderr).slice(0, 3000) : null
        });
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

    Metrics.recordReportLatency(format, Date.now() - __metricsStart);
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
