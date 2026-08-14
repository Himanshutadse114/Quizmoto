const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function safeRm(dir) {
    if (!dir) return;
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
        // best-effort cleanup
    }
}

function pythonCandidates() {
    return [
        process.env.SCORM_VISUAL_PYTHON_CMD,
        process.env.REPORT_PYTHON_CMD,
        '/usr/bin/python3',
        'python3',
        'python'
    ].filter(Boolean);
}

async function runVisualGenerator(inputPath, outputDir) {
    const script = path.join(__dirname, '../../utils/generate_scorm_visuals_v5.py');
    if (!fs.existsSync(script)) {
        const err = new Error('SCORM visual generator script is missing');
        err.code = 'SCORM_VISUAL_SCRIPT_MISSING';
        throw err;
    }

    let lastErr = null;
    const timeout = Number(process.env.SCORM_VISUAL_TIMEOUT_MS || 30000);
    for (const python of pythonCandidates()) {
        try {
            await execFileAsync(python, [script, inputPath, outputDir], {
                timeout,
                windowsHide: true,
                killSignal: 'SIGTERM',
                env: { ...process.env, PYTHONUNBUFFERED: '1' },
                maxBuffer: 4 * 1024 * 1024
            });
            return;
        } catch (err) {
            lastErr = err;
            if (err && err.code === 'ENOENT') continue;
            break;
        }
    }
    throw lastErr || new Error('No Python runtime is available for SCORM visuals');
}

function readAsset(outputDir, file) {
    const safeFile = path.basename(String(file || ''));
    const diskPath = path.join(outputDir, safeFile);
    if (!safeFile || !fs.existsSync(diskPath)) return null;
    return {
        file: safeFile,
        zipPath: `assets/visuals/${safeFile}`,
        body: fs.readFileSync(diskPath)
    };
}

async function generateVisualAssets(analysis) {
    const root = process.env.SCORM_VISUAL_TMP_DIR || path.join(__dirname, '../../data/tmp');
    ensureDir(root);
    const jobId = crypto.randomBytes(8).toString('hex');
    const jobDir = path.join(root, `visual-${jobId}`);
    const outputDir = path.join(jobDir, 'out');
    const inputPath = path.join(jobDir, 'analysis.json');
    ensureDir(outputDir);

    try {
        fs.writeFileSync(inputPath, JSON.stringify(analysis || {}), 'utf8');
        await runVisualGenerator(inputPath, outputDir);
        const manifestPath = path.join(outputDir, 'visual-manifest.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error('Python visual generator did not create a manifest');
        }

        const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const visuals = Array.isArray(parsed.visuals) ? parsed.visuals : [];
        return visuals.map((item) => {
            const desktop = readAsset(outputDir, item.desktopFile || item.file);
            const mobile = readAsset(outputDir, item.mobileFile);
            if (!desktop) return null;
            return {
                index: Number(item.index),
                layout: String(item.layout || 'cards'),
                screenType: String(item.screenType || ''),
                file: desktop.file,
                zipPath: desktop.zipPath,
                body: desktop.body,
                desktopFile: desktop.file,
                desktopZipPath: desktop.zipPath,
                desktopBody: desktop.body,
                mobileFile: mobile ? mobile.file : null,
                mobileZipPath: mobile ? mobile.zipPath : null,
                mobileBody: mobile ? mobile.body : null
            };
        }).filter(Boolean);
    } finally {
        safeRm(jobDir);
    }
}

module.exports = {
    generateVisualAssets,
    runVisualGenerator
};
