/**
 * Shared report generation (PDF / Excel).
 * Primary: Phase 3 Python report (generate_report.py) — full branded layout.
 * Fallback: pure Node (pdfkit + exceljs) if Python fails.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { GameSession, Player, PlayerAnswer } = require('../models/GameSession');
const { Quiz, Question } = require('../models/Quiz');
const Metrics = require('../utils/metrics');
const { generateReportNode } = require('../utils/nodeReportGenerator');

const execFileAsync = promisify(execFile);

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
    return GameSession.findOne({
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
}

function writeStubArtifact(outputPath, format) {
    if (format === 'pdf') fs.writeFileSync(outputPath, Buffer.from('%PDF-1.4\n% stub report\n'));
    else fs.writeFileSync(outputPath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
}

function contentTypeFor(format) {
    return format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

function pythonCandidates() {
    // Test the real fallback path deterministically instead of depending on which
    // Python packages happen to exist on the CI runner.
    if (process.env.TEST_PYTHON_FAIL) return ['invalid_python_cmd_xyz'];
    return [
        process.env.REPORT_PYTHON_CMD,
        '/usr/bin/python3',
        'python3',
        'python'
    ].filter(Boolean);
}

/**
 * Phase 3 Python report (full branded Kahoot-style layout).
 */
async function tryPythonGenerate(jsonPath, outputPath, format, dir) {
    const scriptPath = path.join(__dirname, '../utils/generate_report.py');
    if (!fs.existsSync(scriptPath)) throw new Error('Python script missing: ' + scriptPath);

    const timeoutMs = Number(process.env.REPORT_GEN_TIMEOUT_MS) || 60000;
    // Matplotlib cache/config files are runtime scratch data, not report
    // artifacts. Keep them out of the report directory so downloads and cleanup
    // do not leave hidden .mplconfig folders behind.
    const defaultMplDir = path.join(os.tmpdir(), `quizmoto-mpl-${process.pid}`);
    const env = {
        ...process.env,
        MPLCONFIGDIR: process.env.MPLCONFIGDIR || defaultMplDir,
        PYTHONUNBUFFERED: '1',
        HOME: process.env.HOME || dir,
        REPORT_CHART_DIR: process.env.REPORT_CHART_DIR || path.join(os.tmpdir(), 'quizmoto-report-charts')
    };
    try {
        ensureDir(env.MPLCONFIGDIR);
        ensureDir(env.REPORT_CHART_DIR);
    } catch (_) { /* ignore */ }

    let lastErr = null;
    for (const pyCmd of pythonCandidates()) {
        try {
            const { stdout, stderr } = await execFileAsync(
                pyCmd,
                [scriptPath, jsonPath, outputPath, format],
                {
                    timeout: timeoutMs,
                    windowsHide: true,
                    killSignal: 'SIGTERM',
                    env,
                    maxBuffer: 8 * 1024 * 1024
                }
            );
            if (stderr && String(stderr).trim()) {
                console.error('[report-gen] python stderr:', String(stderr).slice(0, 3000));
            }
            if (stdout && String(stdout).trim()) {
                console.log('[report-gen] python stdout:', String(stdout).slice(0, 500));
            }
            if (!fs.existsSync(outputPath)) throw new Error('Python did not create output file');
            return;
        } catch (err) {
            lastErr = err;
            const msg = (err && (err.stderr || err.message)) || '';
            console.error('[report-gen] python attempt failed', {
                pyCmd,
                message: err && err.message,
                code: err && err.code,
                stderr: msg ? String(msg).slice(0, 2000) : null
            });
            try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) { /* ignore */ }
            if (err && err.code === 'ENOENT' && !process.env.TEST_PYTHON_FAIL) continue;
            break;
        }
    }
    throw lastErr || new Error('Python report generation failed');
}

/**
 * Generate a report file for a session.
 * Prefers Phase 3 Python report; falls back to Node if Python fails.
 */
async function generateReportFile({
    sessionId,
    hostId,
    format = 'pdf',
    testRunId = null,
    keepFiles = false
}) {
    const metricsStart = Date.now();

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

    if (process.env.REPORT_GEN_STUB === '1') {
        writeStubArtifact(outputPath, format);
        if (!keepFiles) {
            try { fs.unlinkSync(jsonPath); } catch (_) { /* ignore */ }
        }
        Metrics.recordReportLatency(format, Date.now() - metricsStart);
        return {
            outputPath,
            jsonPath,
            format,
            contentType: contentTypeFor(format),
            downloadName: `Report${ext}`
        };
    }

    const forceNode = ['1', 'true', 'yes', 'on'].includes(String(process.env.REPORT_FORCE_NODE || '').toLowerCase());
    const skipPython = forceNode || ['1', 'true', 'yes', 'on'].includes(String(process.env.REPORT_SKIP_PYTHON || '').toLowerCase());

    let generated = false;
    let lastErr = null;
    let engine = null;

    if (!skipPython) {
        try {
            await tryPythonGenerate(jsonPath, outputPath, format, dir);
            generated = true;
            engine = 'python';
            console.log('[report-gen] used Phase-3 python report', { sessionId, format });
        } catch (err) {
            lastErr = err;
            console.error('[report-gen] Phase-3 python failed, falling back to node', {
                sessionId,
                format,
                message: err && err.message,
                stderr: err && err.stderr ? String(err.stderr).slice(0, 2000) : null
            });
            try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) { /* ignore */ }
        }
    }

    if (!generated) {
        try {
            await generateReportNode(sessionJson, outputPath, format);
            if (!fs.existsSync(outputPath)) throw new Error('Node generator did not create output file');
            generated = true;
            engine = 'node';
            console.log('[report-gen] used node fallback report', { sessionId, format });
        } catch (err) {
            lastErr = err;
            console.error('[report-gen] node fallback failed', {
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

    Metrics.recordReportLatency(format, Date.now() - metricsStart);
    return {
        outputPath,
        jsonPath,
        format,
        contentType: contentTypeFor(format),
        downloadName: `Report${ext}`,
        engine
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
    artifactsDir,
    tryPythonGenerate
};
