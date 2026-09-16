'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');

const execFileAsync = promisify(execFile);

const MAX_PRESENTATION_SLIDES = 80;
const MAX_SLIDE_BYTES = 450 * 1024;
const START_QUALITY = 84;
const MIN_QUALITY = 28;

function integerEnv(name, fallback, min, max) {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
}

function isPdf(mimeType, fileName) {
    return String(mimeType || '').toLowerCase().includes('pdf') || /\.pdf$/i.test(String(fileName || ''));
}

function isPptx(mimeType, fileName) {
    const mime = String(mimeType || '').toLowerCase();
    return mime.includes('presentationml.presentation') || /\.pptx$/i.test(String(fileName || ''));
}

function presentationKind(mimeType, fileName) {
    if (isPdf(mimeType, fileName)) return 'pdf';
    if (isPptx(mimeType, fileName)) return 'pptx';
    const error = new Error('Presentation courses support PPTX and PDF files only.');
    error.code = 'SCORM_PRESENTATION_TYPE_UNSUPPORTED';
    throw error;
}

function commandError(message, code, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
}

async function runCommand(command, args, options = {}) {
    try {
        return await execFileAsync(command, args, {
            windowsHide: true,
            timeout: options.timeout || 180000,
            maxBuffer: 4 * 1024 * 1024,
            cwd: options.cwd || undefined,
            env: { ...process.env, ...(options.env || {}) }
        });
    } catch (cause) {
        if (cause?.code === 'ENOENT') {
            throw commandError(
                `${options.label || command} is unavailable on the course-generation server.`,
                options.missingCode || 'SCORM_PRESENTATION_RENDERER_MISSING',
                cause
            );
        }
        throw commandError(
            `${options.label || command} could not process the presentation.`,
            options.failureCode || 'SCORM_PRESENTATION_RENDER_FAILED',
            cause
        );
    }
}

function sortRenderedPages(names) {
    return [...names].sort((a, b) => {
        const pageA = Number(String(a).match(/-(\d+)\.png$/i)?.[1] || 0);
        const pageB = Number(String(b).match(/-(\d+)\.png$/i)?.[1] || 0);
        return pageA - pageB;
    });
}

function rgbHex(rgb) {
    return `#${[rgb.r, rgb.g, rgb.b]
        .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
        .join('')}`;
}

function luminance(rgb) {
    const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function colorDistance(a, b) {
    return Math.sqrt(((a.r - b.r) ** 2) + ((a.g - b.g) ** 2) + ((a.b - b.b) ** 2));
}

function quantizeColor(r, g, b) {
    const quantum = 32;
    const snap = (value) => Math.max(0, Math.min(255, Math.round(value / quantum) * quantum));
    return { r: snap(r), g: snap(g), b: snap(b) };
}

function keyFor(rgb) {
    return `${rgb.r},${rgb.g},${rgb.b}`;
}

function parseColorKey(key) {
    const [r, g, b] = String(key).split(',').map(Number);
    return { r, g, b };
}

function adjustedSurface(background) {
    const light = luminance(background) > 0.45;
    const amount = light ? -10 : 14;
    return {
        r: background.r + amount,
        g: background.g + amount,
        b: background.b + amount
    };
}

async function extractTheme(slideBuffers) {
    const overall = new Map();
    const corners = new Map();
    const sampleCount = Math.min(5, slideBuffers.length);

    for (let index = 0; index < sampleCount; index += 1) {
        const { data, info } = await sharp(slideBuffers[index])
            .resize(64, 36, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        for (let y = 0; y < info.height; y += 1) {
            for (let x = 0; x < info.width; x += 1) {
                const offset = (y * info.width + x) * info.channels;
                const rgb = quantizeColor(data[offset], data[offset + 1], data[offset + 2]);
                const key = keyFor(rgb);
                overall.set(key, (overall.get(key) || 0) + 1);
                const isCorner = (x < 6 || x >= info.width - 6) && (y < 5 || y >= info.height - 5);
                if (isCorner) corners.set(key, (corners.get(key) || 0) + 1);
            }
        }
    }

    const rankedCorners = [...corners.entries()].sort((a, b) => b[1] - a[1]);
    const background = rankedCorners.length ? parseColorKey(rankedCorners[0][0]) : { r: 248, g: 250, b: 252 };
    const candidates = [...overall.entries()]
        .map(([key, count]) => ({ rgb: parseColorKey(key), count }))
        .filter(({ rgb }) => {
            const spread = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
            const light = luminance(rgb);
            return spread >= 48 && light > 0.035 && light < 0.82 && colorDistance(rgb, background) >= 72;
        })
        .sort((a, b) => b.count - a.count);

    const primary = candidates[0]?.rgb || (luminance(background) > 0.45
        ? { r: 20, g: 120, b: 130 }
        : { r: 79, g: 201, b: 191 });
    const secondary = candidates.find(({ rgb }) => colorDistance(rgb, primary) >= 80)?.rgb || primary;
    const darkBackground = luminance(background) < 0.34;

    return {
        background: rgbHex(background),
        surface: rgbHex(adjustedSurface(background)),
        primary: rgbHex(primary),
        secondary: rgbHex(secondary),
        text: darkBackground ? '#f8fafc' : '#111827',
        muted: darkBackground ? '#cbd5e1' : '#475467',
        primaryText: luminance(primary) > 0.48 ? '#07110f' : '#ffffff',
        mode: darkBackground ? 'dark' : 'light'
    };
}

async function compressSlide(buffer, width, height, maxBytes = MAX_SLIDE_BYTES) {
    let output = null;
    let quality = START_QUALITY;
    for (let current = START_QUALITY; current >= MIN_QUALITY; current -= 8) {
        quality = current;
        output = await sharp(buffer, { failOn: 'error', limitInputPixels: 120000000 })
            .rotate()
            .resize(width, height, {
                fit: 'contain',
                position: 'centre',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .webp({ quality: current, effort: 4, smartSubsample: true })
            .toBuffer();
        if (output.length <= maxBytes) break;
    }
    return { output, quality };
}

async function processRasterSlides(rawSlideBuffers, options = {}) {
    if (!Array.isArray(rawSlideBuffers) || !rawSlideBuffers.length) {
        const error = new Error('No slides could be rendered from the presentation.');
        error.code = 'SCORM_PRESENTATION_EMPTY';
        throw error;
    }

    const maxSlides = integerEnv('SCORM_PRESENTATION_MAX_SLIDES', MAX_PRESENTATION_SLIDES, 1, 200);
    if (rawSlideBuffers.length > maxSlides) {
        const error = new Error(`Presentation courses support up to ${maxSlides} slides.`);
        error.code = 'SCORM_PRESENTATION_TOO_MANY_SLIDES';
        throw error;
    }

    const firstMetadata = await sharp(rawSlideBuffers[0], { failOn: 'error' }).metadata();
    if (!firstMetadata.width || !firstMetadata.height) {
        const error = new Error('The first presentation slide could not be decoded.');
        error.code = 'SCORM_PRESENTATION_SLIDE_INVALID';
        throw error;
    }

    const maxEdge = Number(options.maxEdge) || integerEnv('SCORM_PRESENTATION_MAX_EDGE', 1600, 960, 2400);
    const firstLongEdge = Math.max(firstMetadata.width, firstMetadata.height);
    const scale = Math.min(1, maxEdge / firstLongEdge);
    let width = Math.max(2, Math.round((firstMetadata.width * scale) / 2) * 2);
    let height = Math.max(2, Math.round((firstMetadata.height * scale) / 2) * 2);
    const maxBytes = Number(options.maxBytes) || integerEnv('SCORM_PRESENTATION_MAX_SLIDE_KB', 450, 120, 1200) * 1024;
    let compressedSlides = [];

    // Compress the deck as one visual unit. If a photograph-heavy slide cannot
    // meet the byte budget, reduce every slide together so all saved images keep
    // identical dimensions and the learner never downloads one oversized outlier.
    while (true) {
        compressedSlides = [];
        for (const source of rawSlideBuffers) {
            compressedSlides.push(await compressSlide(source, width, height, maxBytes));
        }
        const largest = Math.max(...compressedSlides.map((slide) => slide.output.length));
        if (largest <= maxBytes || Math.max(width, height) <= 720) break;
        width = Math.max(2, Math.round((width * 0.82) / 2) * 2);
        height = Math.max(2, Math.round((height * 0.82) / 2) * 2);
    }

    const slides = compressedSlides.map((compressed, index) => ({
        path: `slides/slide-${String(index + 1).padStart(3, '0')}.webp`,
        body: compressed.output,
        contentType: 'image/webp',
        width,
        height,
        byteSize: compressed.output.length,
        quality: compressed.quality
    }));

    const theme = await extractTheme(slides.map((slide) => slide.body));
    return {
        slides,
        theme,
        width,
        height,
        aspectRatio: Math.round((width / height) * 10000) / 10000,
        totalBytes: slides.reduce((sum, slide) => sum + slide.byteSize, 0)
    };
}

async function pdfPageCount(pdfPath) {
    const pdfInfo = process.env.PDFINFO_PATH || 'pdfinfo';
    const result = await runCommand(pdfInfo, [pdfPath], {
        label: 'PDF page reader',
        missingCode: 'SCORM_PRESENTATION_PDF_TOOLS_MISSING'
    });
    const pages = Number(String(result.stdout || '').match(/^Pages:\s+(\d+)/mi)?.[1] || 0);
    if (!pages) {
        const error = new Error('The presentation contains no readable pages.');
        error.code = 'SCORM_PRESENTATION_EMPTY';
        throw error;
    }
    return pages;
}

async function renderPdfPages(pdfPath, tempDir) {
    const pages = await pdfPageCount(pdfPath);
    const maxSlides = integerEnv('SCORM_PRESENTATION_MAX_SLIDES', MAX_PRESENTATION_SLIDES, 1, 200);
    if (pages > maxSlides) {
        const error = new Error(`Presentation courses support up to ${maxSlides} slides.`);
        error.code = 'SCORM_PRESENTATION_TOO_MANY_SLIDES';
        throw error;
    }

    const pdftoppm = process.env.PDFTOPPM_PATH || 'pdftoppm';
    const prefix = path.join(tempDir, 'rendered-slide');
    await runCommand(pdftoppm, ['-png', '-r', '120', pdfPath, prefix], {
        timeout: 240000,
        label: 'PDF slide renderer',
        missingCode: 'SCORM_PRESENTATION_PDF_TOOLS_MISSING'
    });
    const names = sortRenderedPages((await fs.readdir(tempDir)).filter((name) => /^rendered-slide-\d+\.png$/i.test(name)));
    return Promise.all(names.map((name) => fs.readFile(path.join(tempDir, name))));
}

async function convertPptxToPdf(sourcePath, tempDir) {
    const soffice = process.env.LIBREOFFICE_PATH || 'soffice';
    const profileDir = path.join(tempDir, 'libreoffice-profile');
    await fs.mkdir(profileDir, { recursive: true });
    const profileUrl = `file://${profileDir.replace(/\\/g, '/')}`;
    await runCommand(soffice, [
        '--headless',
        '--nologo',
        '--nodefault',
        '--nofirststartwizard',
        `-env:UserInstallation=${profileUrl}`,
        '--convert-to',
        'pdf',
        '--outdir',
        tempDir,
        sourcePath
    ], {
        timeout: 240000,
        label: 'PowerPoint renderer',
        missingCode: 'SCORM_PRESENTATION_LIBREOFFICE_MISSING'
    });
    const expected = path.join(tempDir, `${path.basename(sourcePath, path.extname(sourcePath))}.pdf`);
    try {
        await fs.access(expected);
        return expected;
    } catch (_) {
        const pdfName = (await fs.readdir(tempDir)).find((name) => /\.pdf$/i.test(name));
        if (pdfName) return path.join(tempDir, pdfName);
        throw commandError('PowerPoint conversion did not produce a PDF.', 'SCORM_PRESENTATION_RENDER_FAILED');
    }
}

async function renderPresentation({ sourceBuffer, mimeType, fileName }) {
    const kind = presentationKind(mimeType, fileName);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lmsgen-presentation-'));
    try {
        const sourceName = kind === 'pdf' ? 'source.pdf' : 'source.pptx';
        const sourcePath = path.join(tempDir, sourceName);
        await fs.writeFile(sourcePath, sourceBuffer);
        const pdfPath = kind === 'pdf' ? sourcePath : await convertPptxToPdf(sourcePath, tempDir);
        const pdfBuffer = await fs.readFile(pdfPath);
        const rawSlides = await renderPdfPages(pdfPath, tempDir);
        const processed = await processRasterSlides(rawSlides);
        return {
            ...processed,
            kind,
            pdfBuffer
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

module.exports = {
    MAX_PRESENTATION_SLIDES,
    MAX_SLIDE_BYTES,
    presentationKind,
    sortRenderedPages,
    extractTheme,
    processRasterSlides,
    renderPresentation
};
