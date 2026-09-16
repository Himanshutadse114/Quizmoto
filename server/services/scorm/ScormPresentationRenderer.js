'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pathToFileURL } = require('url');
const sharp = require('sharp');
const JSZip = require('jszip');

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

function normalizePptxSvgFontFamilies(svg) {
    const source = String(svg || '');
    const normalizedFamilies = source.replace(/<[^>]+\bfont-family="[^"]+"[^>]*>/gi, (tag) => {
        const bold = /\bfont-weight="(?:bold|[6-9]00)"/i.test(tag);
        const italic = /\bfont-style="(?:italic|oblique)"/i.test(tag);
        if (!bold && !italic) return tag;

        return tag.replace(/\bfont-family="([^"]+)"/i, (attribute, familyList) => {
            const normalized = familyList.split(',').map((entry) => {
                const leading = entry.match(/^\s*/)?.[0] || '';
                const trailing = entry.match(/\s*$/)?.[0] || '';
                const raw = entry.trim();
                const quote = raw.startsWith("'") && raw.endsWith("'") ? "'" : '';
                let family = quote ? raw.slice(1, -1) : raw;

                // pptx-svg emits face names such as "Lato Bold" as CSS family
                // names. Fontconfig knows that face as family "Lato" plus a
                // bold weight, so leaving the suffix causes a much wider
                // fallback font and clipped PowerPoint text boxes.
                if (bold) family = family.replace(/\s+(?:extra\s*bold|semi\s*bold|semibold|demi\s*bold|bold)$/i, '');
                if (italic) family = family.replace(/\s+(?:italic|oblique)$/i, '');

                return `${leading}${quote}${family}${quote}${trailing}`;
            }).join(',');
            return `font-family="${normalized}"`;
        });
    });

    const normalizedSizes = normalizedFamilies.replace(
        /<tspan\b(?=[^>]*\bfont-size="[^"]+")(?=[^>]*\bdata-ooxml-font-size="(\d+)")[^>]*>/gi,
        (tag, rawSize, offset, completeSvg) => {
            const points = Number(rawSize) / 100;
            if (!Number.isFinite(points) || points <= 0) return tag;

            // PowerPoint stores run sizes in hundredths of a point. pptx-svg
            // occasionally copies that point value into a CSS pixel size (for
            // example 38.5pt -> 39px), making the learner slide visibly smaller
            // than PowerPoint. Apply the 96dpi point-to-pixel conversion and the
            // text box's OOXML autofit scale so both size and wrapping are kept.
            const groupStart = completeSvg.lastIndexOf('<g ', offset);
            const previousGroupEnd = completeSvg.lastIndexOf('</g>', offset);
            let fontScale = 100000;
            if (groupStart > previousGroupEnd) {
                const groupTagEnd = completeSvg.indexOf('>', groupStart);
                const groupTag = groupTagEnd > groupStart
                    ? completeSvg.slice(groupStart, groupTagEnd + 1)
                    : '';
                const parsedScale = Number(groupTag.match(/\bdata-ooxml-font-scale="(-?\d+)"/i)?.[1]);
                if (Number.isFinite(parsedScale) && parsedScale > 0) fontScale = parsedScale;
            }

            const pixels = points * (96 / 72) * (fontScale / 100000);
            const cssPixels = String(Math.round(pixels * 1000) / 1000);
            return tag.replace(/\bfont-size="[^"]+"/i, `font-size="${cssPixels}"`);
        }
    );

    return normalizedSizes.replace(
        /<g\b(?=[^>]*\bdata-ooxml-line-spacing="\d+")[^>]*>[\s\S]*?<\/g>/gi,
        (group) => {
            const spacing = Number(group.match(/\bdata-ooxml-line-spacing="(\d+)"/i)?.[1] || 100000);
            const rectY = Number(group.match(/<rect\b[^>]*\by="([\d.]+)"/i)?.[1]);
            const topInset = Number(group.match(/\bdata-ooxml-t-ins="([\d.-]+)"/i)?.[1]);
            const topAnchored = /\bdata-ooxml-anchor="t"/i.test(group);
            const sizes = [...group.matchAll(/<tspan\b[^>]*\sfont-size="([\d.]+)"/gi)]
                .map((match) => Number(match[1]))
                .filter((value) => Number.isFinite(value) && value > 0);
            const lineTags = [...group.matchAll(/<tspan\b(?=[^>]*\bdata-ooxml-para-idx="\d+")[^>]*>/gi)];
            if (!lineTags.length || !sizes.length || !Number.isFinite(spacing)) return group;

            const fontSize = Math.max(...sizes);
            const originalFirstY = Number(lineTags[0][0].match(/\by="([\d.]+)"/i)?.[1]);
            const canAnchorFromTop = topAnchored
                && Number.isFinite(rectY)
                && (!Number.isFinite(topInset) || topInset === 0);
            const firstY = canAnchorFromTop
                ? rectY + fontSize
                : originalFirstY;
            if (!Number.isFinite(firstY)) return group;

            // PowerPoint percentage line spacing is applied to the font's
            // normal 1.2 line box, not directly to the glyph height.
            const lineStep = fontSize * 1.2 * (spacing / 100000);
            let lineIndex = 0;
            return group.replace(
                /<tspan\b(?=[^>]*\bdata-ooxml-para-idx="\d+")[^>]*>/gi,
                (tag) => {
                    const y = Math.round((firstY + (lineStep * lineIndex)) * 1000) / 1000;
                    lineIndex += 1;
                    return /\by="[^"]+"/i.test(tag)
                        ? tag.replace(/\by="[^"]+"/i, `y="${y}"`)
                        : tag;
                }
            );
        }
    );
}

async function renderPptxWithSvgEngine(sourcePath, tempDir) {
    const outputDir = path.join(tempDir, 'pptx-svg-output');
    const runnerPath = path.join(__dirname, '..', '..', 'utils', 'render_pptx_svg.mjs');
    await fs.mkdir(outputDir, { recursive: true });

    await runCommand(process.execPath, [
        '--experimental-wasm-imported-strings',
        '--experimental-wasm-stringref',
        runnerPath,
        sourcePath,
        outputDir
    ], {
        timeout: 240000,
        label: 'PowerPoint compatibility renderer',
        missingCode: 'SCORM_PRESENTATION_FALLBACK_MISSING',
        failureCode: 'SCORM_PRESENTATION_FALLBACK_FAILED'
    });

    const names = (await fs.readdir(outputDir))
        .filter((name) => /^fallback-slide-\d+\.svg$/i.test(name))
        .sort((a, b) => Number(a.match(/(\d+)\.svg$/i)?.[1] || 0) - Number(b.match(/(\d+)\.svg$/i)?.[1] || 0));

    if (!names.length) {
        const error = new Error('The PowerPoint compatibility renderer produced no slides.');
        error.code = 'SCORM_PRESENTATION_EMPTY';
        throw error;
    }

    return Promise.all(names.map(async (name) => {
        const svg = await fs.readFile(path.join(outputDir, name), 'utf8');
        return Buffer.from(normalizePptxSvgFontFamilies(svg), 'utf8');
    }));
}

async function sanitizePptxForCompatibility(sourceBuffer) {
    const archive = await JSZip.loadAsync(sourceBuffer);
    const names = Object.keys(archive.files);

    names
        .filter((name) => /^ppt\/notes(?:Slides|Masters)\//i.test(name))
        .forEach((name) => archive.remove(name));

    const relationshipNames = names.filter((name) => /\.rels$/i.test(name));
    for (const name of relationshipNames) {
        const entry = archive.file(name);
        if (!entry) continue;
        const xml = await entry.async('string');
        const cleaned = xml.replace(
            /<Relationship\b(?=[^>]*\bType="[^"]*\/notes(?:Slide|Master)")(?:(?:"[^"]*")|[^>])*\/?>(?:<\/Relationship>)?/gi,
            ''
        );
        if (cleaned !== xml) archive.file(name, cleaned);
    }

    const contentTypes = archive.file('[Content_Types].xml');
    if (contentTypes) {
        const xml = await contentTypes.async('string');
        archive.file('[Content_Types].xml', xml.replace(
            /<Override\b(?=[^>]*\bPartName="\/ppt\/notes(?:Slides|Masters)\/[^\"]+")(?:(?:"[^"]*")|[^>])*\/?>(?:<\/Override>)?/gi,
            ''
        ));
    }

    return archive.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
}

async function findConvertedPdf(sourcePath, tempDir) {
    const expected = path.join(tempDir, `${path.basename(sourcePath, path.extname(sourcePath))}.pdf`);
    const candidates = [expected];
    const names = await fs.readdir(tempDir);
    for (const name of names) {
        const candidate = path.join(tempDir, name);
        if (/\.pdf$/i.test(name) && candidate !== expected) candidates.push(candidate);
    }

    for (const candidate of candidates) {
        try {
            const handle = await fs.open(candidate, 'r');
            const header = Buffer.alloc(5);
            await handle.read(header, 0, header.length, 0);
            await handle.close();
            const stat = await fs.stat(candidate);
            if (stat.size > 100 && header.toString('ascii') === '%PDF-') return candidate;
        } catch {
            // Try the next possible output path.
        }
    }
    return null;
}

async function runLibreOfficeConversion(command, sourcePath, tempDir, profileSuffix) {
    const profileDir = path.join(tempDir, `libreoffice-profile-${profileSuffix}`);
    const runtimeDir = path.join(tempDir, `runtime-${profileSuffix}`);
    await fs.mkdir(profileDir, { recursive: true });
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.chmod(runtimeDir, 0o700);
    const profileUrl = pathToFileURL(profileDir).href;
    let commandFailure = null;

    try {
        await runCommand(command, [
            '--headless',
            '--invisible',
            '--nologo',
            '--nodefault',
            '--nolockcheck',
            '--norestore',
            '--nofirststartwizard',
            `-env:UserInstallation=${profileUrl}`,
            '--convert-to',
            'pdf:impress_pdf_Export',
            '--outdir',
            tempDir,
            sourcePath
        ], {
            timeout: 240000,
            label: 'PowerPoint renderer',
            missingCode: 'SCORM_PRESENTATION_LIBREOFFICE_MISSING',
            env: {
                HOME: tempDir,
                TMPDIR: tempDir,
                XDG_CACHE_HOME: path.join(tempDir, 'cache'),
                XDG_RUNTIME_DIR: runtimeDir
            }
        });
    } catch (error) {
        commandFailure = error;
    }

    // LibreOffice can return a warning exit code after successfully writing the
    // PDF, particularly when an exported deck references unavailable fonts.
    const renderedPdf = await findConvertedPdf(sourcePath, tempDir);
    if (renderedPdf) return renderedPdf;
    if (commandFailure) throw commandFailure;
    throw commandError('PowerPoint conversion did not produce a valid PDF.', 'SCORM_PRESENTATION_RENDER_FAILED');
}

async function convertPptxToPdf(sourcePath, tempDir) {
    const configured = String(process.env.LIBREOFFICE_PATH || '').trim();
    const commands = [configured || 'soffice'];
    const originalBuffer = await fs.readFile(sourcePath);
    let compatibilityPath = '';
    let lastError = null;

    // First preserve the source byte-for-byte. If an exporter produced malformed
    // speaker-note relationships, retry a presentation-only copy; notes are not
    // visible on slides and removing them does not change the learner artwork.
    try {
        const compatible = await sanitizePptxForCompatibility(originalBuffer);
        compatibilityPath = path.join(tempDir, 'source-compatible.pptx');
        await fs.writeFile(compatibilityPath, compatible);
    } catch {
        compatibilityPath = '';
    }

    const sources = [sourcePath, compatibilityPath].filter(Boolean);
    for (const command of commands) {
        for (let index = 0; index < sources.length; index += 1) {
            try {
                return await runLibreOfficeConversion(command, sources[index], tempDir, `${commands.indexOf(command)}-${index}`);
            } catch (error) {
                lastError = error;
            }
        }
    }

    const error = commandError(
        'The PowerPoint deck could not be rendered. Exporting the deck as PDF will preserve the same slide design.',
        lastError?.code || 'SCORM_PRESENTATION_RENDER_FAILED',
        lastError
    );
    throw error;
}

async function renderPresentation({ sourceBuffer, mimeType, fileName }) {
    const kind = presentationKind(mimeType, fileName);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lmsgen-presentation-'));
    try {
        const sourceName = kind === 'pdf' ? 'source.pdf' : 'source.pptx';
        const sourcePath = path.join(tempDir, sourceName);
        await fs.writeFile(sourcePath, sourceBuffer);
        let pdfBuffer = null;
        let rawSlides = null;
        let renderEngine = kind === 'pdf' ? 'pdf' : 'libreoffice';

        if (kind === 'pdf') {
            pdfBuffer = await fs.readFile(sourcePath);
            rawSlides = await renderPdfPages(sourcePath, tempDir);
        } else {
            try {
                // The production image includes the Lato faces used by Gamma.
                // With the real font available, the office/PDF engine preserves
                // PowerPoint point sizes, weights, line spacing and wrapping
                // more faithfully than reconstructing those rules from SVG.
                const pdfPath = await convertPptxToPdf(sourcePath, tempDir);
                pdfBuffer = await fs.readFile(pdfPath);
                rawSlides = await renderPdfPages(pdfPath, tempDir);
            } catch (officeError) {
                try {
                    rawSlides = await renderPptxWithSvgEngine(sourcePath, tempDir);
                    renderEngine = 'pptx-svg';
                } catch (svgError) {
                    const error = commandError(
                        'The PowerPoint deck could not be rendered by either available presentation engine.',
                        'SCORM_PRESENTATION_RENDER_FAILED',
                        svgError
                    );
                    error.officeError = officeError;
                    throw error;
                }
            }
        }

        const processed = await processRasterSlides(rawSlides);
        const quizSourceBuffer = pdfBuffer || sourceBuffer;
        return {
            ...processed,
            kind,
            pdfBuffer,
            quizSourceBuffer,
            quizSourceMimeType: pdfBuffer
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            quizSourceFileName: pdfBuffer
                ? `${path.basename(fileName || 'presentation', path.extname(fileName || '')) || 'presentation'}.pdf`
                : (fileName || 'presentation.pptx'),
            renderEngine
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
    sanitizePptxForCompatibility,
    normalizePptxSvgFontFamilies,
    renderPptxWithSvgEngine,
    renderPresentation
};
