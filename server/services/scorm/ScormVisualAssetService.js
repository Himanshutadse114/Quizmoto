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
    const script = path.join(__dirname, '../../utils/generate_scorm_visuals_v5_resolved.py');
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

function shiftNumericAttributes(fragment, attribute, delta) {
    const pattern = new RegExp(`${attribute}="([0-9.]+)"`, 'g');
    return fragment.replace(pattern, (_match, value) => {
        const shifted = Number(value) + delta;
        return `${attribute}="${Number.isInteger(shifted) ? shifted : shifted.toFixed(1)}"`;
    });
}

/**
 * Desktop vector cards sometimes combine an icon and a long metric label on the
 * same horizontal line. At laptop scale that leaves too little usable text width.
 * Keep the original deterministic SVG, but give dense desktop layouts safer type
 * geometry before they are embedded into the SCORM ZIP.
 */
function polishDesktopSvg(body, layout) {
    if (!body) return body;
    let svg = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
    const kind = String(layout || '').toLowerCase();

    if (kind === 'cards') {
        // Move card body copy below the icon/POINT row and use almost the full card
        // width. This removes the horizontal collision visible on 1366/1440px
        // laptops while preserving the original icon and heading hierarchy.
        svg = svg.replace(
            /<text x="([0-9.]+)" y="([0-9.]+)" text-anchor="start" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="14" font-weight="720"[\s\S]*?<\/text>/g,
            (fragment) => {
                let next = shiftNumericAttributes(fragment, 'x', -70);
                next = shiftNumericAttributes(next, 'y', 34);
                return next.replace('font-size="14"', 'font-size="13"');
            }
        );
    } else if (kind === 'hub') {
        svg = svg.replace(/font-size="13" font-weight="720"/g, 'font-size="11.5" font-weight="720"');
    } else if (kind === 'timeline') {
        svg = svg.replace(/font-size="14" font-weight="720"/g, 'font-size="12" font-weight="720"');
    } else if (kind === 'process' || kind === 'cycle') {
        svg = svg.replace(/font-size="16" font-weight="760"/g, 'font-size="13.5" font-weight="760"');
    }

    return Buffer.from(svg, 'utf8');
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
            const layout = String(item.layout || 'cards');
            const polishedDesktopBody = polishDesktopSvg(desktop.body, layout);
            return {
                index: Number(item.index),
                layout,
                screenType: String(item.screenType || ''),
                file: desktop.file,
                zipPath: desktop.zipPath,
                body: polishedDesktopBody,
                desktopFile: desktop.file,
                desktopZipPath: desktop.zipPath,
                desktopBody: polishedDesktopBody,
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
    runVisualGenerator,
    polishDesktopSvg,
    shiftNumericAttributes
};
