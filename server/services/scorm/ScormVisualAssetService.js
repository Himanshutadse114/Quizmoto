const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../../utils/logger');
const { planSvgScenes, fallbackSpec } = require('./ScormSvgScenePlanner');
const {
    paletteFromAnalysis,
    renderSmartSvg
} = require('./ScormSmartSvgRenderer');
const { renderCourseCoverSvg } = require('./ScormCourseCoverRenderer');

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

async function generateLegacyVisualAssets(analysis) {
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
                mobileBody: mobile ? mobile.body : null,
                visualEngine: 'legacy-python'
            };
        }).filter(Boolean);
    } finally {
        safeRm(jobDir);
    }
}

function smartSvgFilename(index, mobile = false) {
    const number = String(index + 1).padStart(3, '0');
    return `smart-visual-${number}${mobile ? '-mobile' : ''}.svg`;
}

function courseCoverSource(analysis = {}) {
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    const themeText = slides.slice(0, 6).map((slide) => {
        const points = Array.isArray(slide?.keyPoints) ? slide.keyPoints.slice(0, 3).join(' ') : '';
        return `${slide?.title || ''} ${slide?.content || ''} ${points}`;
    }).join(' ');
    return {
        title: String(analysis.title || 'Learning experience'),
        content: `${analysis.summary || ''} ${themeText}`.trim(),
        keyPoints: slides.slice(0, 5).map((slide) => String(slide?.title || '')).filter(Boolean),
        layout: 'spotlight',
        screenType: 'takeaway',
        visualTitle: String(analysis.title || 'Learning experience')
    };
}

function generateCourseCoverAsset(analysis = {}) {
    const palette = paletteFromAnalysis(analysis);
    const source = courseCoverSource(analysis);
    const baseSpec = fallbackSpec(source, 0);
    const spec = {
        ...baseSpec,
        composition: 'center-stage',
        visualTitle: source.visualTitle,
        artDirection: 'Premium editorial course opener with a strong central learning journey, layered depth and restrained supporting symbols.'
    };
    const desktopFile = 'course-cover.svg';
    const mobileFile = 'course-cover-mobile.svg';
    const desktopSvg = renderCourseCoverSvg(spec, analysis, { palette, mobile: false });
    const mobileSvg = renderCourseCoverSvg(spec, analysis, { palette, mobile: true });
    const desktopBody = Buffer.from(desktopSvg, 'utf8');
    const mobileBody = Buffer.from(mobileSvg, 'utf8');

    return {
        index: -1,
        role: 'cover',
        layout: 'cover',
        screenType: 'cover',
        file: desktopFile,
        zipPath: `assets/visuals/${desktopFile}`,
        body: desktopBody,
        desktopFile,
        desktopZipPath: `assets/visuals/${desktopFile}`,
        desktopBody,
        mobileFile,
        mobileZipPath: `assets/visuals/${mobileFile}`,
        mobileBody,
        visualEngine: 'smart-svg-cover',
        sceneSpec: spec
    };
}

async function generateSmartSvgAssets(analysis = {}) {
    const slides = Array.isArray(analysis.slides) ? analysis.slides : [];
    if (!slides.length) return [];

    const planned = await planSvgScenes(analysis);
    const palette = paletteFromAnalysis(analysis);

    return slides.map((slide, index) => {
        const spec = planned[index];
        const desktopFile = smartSvgFilename(index, false);
        const mobileFile = smartSvgFilename(index, true);
        const desktopSvg = renderSmartSvg(spec, slide, { palette, mobile: false });
        const mobileSvg = renderSmartSvg(spec, slide, { palette, mobile: true });
        const desktopBody = Buffer.from(desktopSvg, 'utf8');
        const mobileBody = Buffer.from(mobileSvg, 'utf8');

        return {
            index,
            layout: String(slide?.layout || 'cards'),
            screenType: String(slide?.screenType || ''),
            file: desktopFile,
            zipPath: `assets/visuals/${desktopFile}`,
            body: desktopBody,
            desktopFile,
            desktopZipPath: `assets/visuals/${desktopFile}`,
            desktopBody,
            mobileFile,
            mobileZipPath: `assets/visuals/${mobileFile}`,
            mobileBody,
            visualEngine: 'gemini-smart-svg',
            sceneSpec: spec
        };
    });
}

function useLegacyEngine() {
    const engine = String(process.env.SCORM_VISUAL_ENGINE || '').trim().toLowerCase();
    if (engine === 'legacy-python' || engine === 'python') return true;
    return String(process.env.SCORM_SMART_SVG_ENABLED || 'true').trim().toLowerCase() === 'false';
}

async function generateVisualAssets(analysis) {
    if (useLegacyEngine()) {
        logger.info('scorm_visual_engine_selected', { module: 'scorm', engine: 'legacy-python' });
        return generateLegacyVisualAssets(analysis);
    }

    logger.info('scorm_visual_engine_selected', { module: 'scorm', engine: 'gemini-smart-svg' });
    try {
        return await generateSmartSvgAssets(analysis);
    } catch (err) {
        // Smart SVG itself has a local planner fallback. Reaching this catch means
        // rendering failed unexpectedly, so fail closed instead of silently
        // returning to the low-fidelity vector engine the product is replacing.
        logger.error('scorm_smart_svg_generation_failed', { module: 'scorm', error: err.message });
        throw err;
    }
}

module.exports = {
    generateVisualAssets,
    generateSmartSvgAssets,
    generateCourseCoverAsset,
    generateLegacyVisualAssets,
    smartSvgFilename,
    courseCoverSource,
    useLegacyEngine,
    runVisualGenerator
};
