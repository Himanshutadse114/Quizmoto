/**
 * Shared report generation (PDF / Excel).
 * Primary path: pure Node.js (pdfkit + exceljs) — no Python required.
 * Optional: REPORT_USE_PYTHON=1 to try the Python script first.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const Metrics = require('../utils/metrics');
const { generateReportNode } = require('../utils/nodeReportGenerator');

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

function writeStubArtifact(outputPath, format) {
    if (format === 'pdf') {
        fs.writeFileSync(outputPath, Buffer.from('%PDF-1.4\n% stub report\n'));
    } else {
        fs.writeFileSync(outputPath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
    }
}

function contentTypeFor(format) {
    return format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

async function tryPythonGenerate(jsonPath, outputPath, format, dir, sessionId) {
    const scriptPath = path.join(__dirname, '../utils/generate_report.py');
    if (!fs.existsSync(scriptPath)) {
        throw new Error('Python script missing');
    }
    const pyCmd = resolvePythonCmd();
    const timeoutMs = Number(process.env.REPORT_GEN_TIMEOUT_MS) || 30000;
    const env = {
        ...process.env,
        MPLCONFIGDIR: process.env.MPLCONFIGDIR || path.join(dir, '.mplconfig'),
        PYTHONUNBUFFERED: '1'
    };
    try {
        ensureDir(env.MPLCONFIGDIR);
    } catch (_) { /* ignore */ }

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
    if (!fs.existsSync(outputPath)) {
        throw new Error('Python did not create output file');
    }
}

/**
 * Generate a report file for a session.
 * @returns {Promise<{ outputPath, jsonPath, format, contentType, downloadName }>}
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
    const sessionJson = session.toJSON();
    fs.writeFileSync(jsonPath, JSON.stringify(sessionJson));

    // Unit-test stub
    if (process.env.REPORT_GEN_STUB === '1') {
        writeStubArtifact(outputPath, format);
        if (!keepFiles) {
            try { fs.unlinkSync(jsonPath); } catch (_) { /* ignore */ }
        }
        Metrics.recordReportLatency(format, Date.now() - __metricsStart);
        return {
            outputPath,
            jsonPath,
            format,
            contentType: contentTypeFor(format),
            downloadName: `Report${ext}`
        };
    }

    const usePythonFirst = ['1', 'true', 'yes', 'on'].includes(
        String(process.env.REPORT_USE_PYTHON || '').toLowerCase()
    );

    let generated = false;
    let lastErr = null;

    if (usePythonFirst) {
        try {
            await tryPythonGenerate(jsonPath, outputPath, format, dir, sessionId);
            generated = true;
            console.log('[report-gen] used python path', { sessionId, format });
        } catch (err) {
            lastErr = err;
            console.error('[report-gen] python path failed, falling back to node', {
                sessionId,
                format,
                message: err && err.message,
                stderr: err && err.stderr ? String(err.stderr).slice(0, 1500) : null
            });
            try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) { /* ignore */ }
        }
    }

    if (!generated) {
        try {
            await generateReportNode(sessionJson, outputPath, format);
            if (!fs.existsSync(outputPath)) {
                throw new Error('Node generator did not create output file');
            }
            generated = true;
            console.log('[report-gen] used node path', { sessionId, format });
        } catch (err) {
            lastErr = err;
            console.error('[report-gen] node path failed', {
                sessionId,
                format,
                message: err && err.message,
                stack: err && err.stack ? String(err.stack).slice(0, 1500) : null
            });
        }
    }

    if (!keepFiles) {
        try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch (_) { /* ignore */ }
    }

    if (!generated) {
        const wrapped = new Error('Report generation failed');
        wrapped.code = 'REPORT_GEN_FAILED';
        wrapped.cause = lastErr;
        throw wrapped;
    }

    Metrics.recordReportLatency(format, Date.now() - __metricsStart);
    return {
        outputPath,
        jsonPath,
        format,
        contentType: contentTypeFor(format),
        downloadName: `Report${ext}`
    };
}

function safeUnlink(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) { /* ignore */ }
}

module.exports = {
    loadSessionForExport,
    generateReportFile,
    safeUnlink,
    artifactsDir
};
