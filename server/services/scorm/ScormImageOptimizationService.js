'use strict';

const sharp = require('sharp');

// One predictable learner-course image profile. At 1280x720 these visuals are
// crisp on ordinary desktop players while remaining light enough for phones and
// slower LMS connections.
const COURSE_IMAGE_WIDTH = 1280;
const COURSE_IMAGE_HEIGHT = 720;
const COURSE_IMAGE_MAX_BYTES = 220 * 1024;
const COURSE_IMAGE_QUALITY = 72;
const COURSE_IMAGE_MIN_QUALITY = 8;

const COVER_ASSET_FIELDS = [
    'coverImageAsset',
    'coverVisualAsset',
    'coverMobileVisualAsset'
];

const SLIDE_ASSET_FIELDS = [
    'visualAsset',
    'rasterVisualAsset',
    'mobileVisualAsset'
];

function asBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    return Buffer.from(value || '');
}

function webpPath(value) {
    const path = String(value || '').trim();
    if (!path) return path;
    const queryIndex = path.search(/[?#]/);
    const suffix = queryIndex >= 0 ? path.slice(queryIndex) : '';
    const base = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
    return `${base.replace(/\.(?:png|jpe?g|webp)$/i, '')}.webp${suffix}`;
}

function replacePath(value, pathMap) {
    const key = String(value || '').trim();
    return pathMap.get(key) || value;
}

function remapAnalysisAssetPaths(rawAnalysis, pathMap) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    for (const field of COVER_ASSET_FIELDS) {
        if (analysis[field]) analysis[field] = replacePath(analysis[field], pathMap);
    }
    analysis.slides = (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide) => {
        const next = { ...(slide || {}) };
        for (const field of SLIDE_ASSET_FIELDS) {
            if (next[field]) next[field] = replacePath(next[field], pathMap);
        }
        if (SLIDE_ASSET_FIELDS.some((field) => next[field])) next.visualAssetType = 'image/webp';
        return next;
    });
    return analysis;
}

async function optimizeCourseImage(file, options = {}) {
    const width = Number(options.width) || COURSE_IMAGE_WIDTH;
    const height = Number(options.height) || COURSE_IMAGE_HEIGHT;
    const maxBytes = Number(options.maxBytes) || COURSE_IMAGE_MAX_BYTES;
    const source = asBuffer(file?.body);
    if (source.length < 16) {
        const error = new Error(`Course image ${file?.path || ''} is empty or invalid.`);
        error.code = 'SCORM_IMAGE_INVALID';
        throw error;
    }

    let metadata;
    try {
        metadata = await sharp(source, { failOn: 'error', limitInputPixels: 100000000 }).metadata();
    } catch (cause) {
        const error = new Error(`Course image ${file?.path || ''} could not be decoded.`);
        error.code = 'SCORM_IMAGE_INVALID';
        error.cause = cause;
        throw error;
    }

    const alreadyOptimized = metadata.format === 'webp'
        && metadata.width === width
        && metadata.height === height
        && source.length <= maxBytes;
    if (alreadyOptimized) {
        return {
            ...file,
            path: webpPath(file.path),
            body: source,
            contentType: 'image/webp',
            width,
            height,
            originalByteSize: source.length,
            byteSize: source.length,
            optimized: true
        };
    }

    let output = null;
    let usedQuality = COURSE_IMAGE_QUALITY;
    for (let quality = COURSE_IMAGE_QUALITY; quality >= COURSE_IMAGE_MIN_QUALITY; quality -= 8) {
        usedQuality = quality;
        output = await sharp(source, { failOn: 'error', limitInputPixels: 100000000 })
            .rotate()
            .resize(width, height, {
                fit: 'cover',
                position: 'centre',
                withoutEnlargement: false
            })
            .webp({ quality, effort: 4, smartSubsample: true })
            .toBuffer();
        if (output.length <= maxBytes) break;
    }

    if (!output || output.length > maxBytes) {
        const error = new Error(`Course image ${file?.path || ''} could not be compressed below ${maxBytes} bytes.`);
        error.code = 'SCORM_IMAGE_TOO_LARGE';
        error.byteSize = output?.length || source.length;
        error.maxBytes = maxBytes;
        throw error;
    }

    return {
        ...file,
        path: webpPath(file.path),
        body: output,
        contentType: 'image/webp',
        width,
        height,
        originalByteSize: source.length,
        byteSize: output.length,
        compressionQuality: usedQuality,
        optimized: true
    };
}

async function optimizeCourseMedia(rawAnalysis, rawFiles, options = {}) {
    const files = [];
    const pathMap = new Map();
    let originalBytes = 0;
    let optimizedBytes = 0;

    // Deliberately process sequentially: generation already runs concurrently,
    // and decoding several multi-megabyte images at once can create memory spikes.
    for (const file of Array.isArray(rawFiles) ? rawFiles : []) {
        const optimized = await optimizeCourseImage(file, options);
        files.push(optimized);
        pathMap.set(String(file?.path || '').trim(), optimized.path);
        originalBytes += optimized.originalByteSize || 0;
        optimizedBytes += optimized.byteSize || 0;
    }

    const analysis = remapAnalysisAssetPaths(rawAnalysis, pathMap);
    const savingsPercent = originalBytes > 0
        ? Math.max(0, Math.round((1 - (optimizedBytes / originalBytes)) * 1000) / 10)
        : 0;
    return {
        analysis,
        files,
        metadata: {
            format: 'webp',
            width: Number(options.width) || COURSE_IMAGE_WIDTH,
            height: Number(options.height) || COURSE_IMAGE_HEIGHT,
            maxBytesPerImage: Number(options.maxBytes) || COURSE_IMAGE_MAX_BYTES,
            originalBytes,
            optimizedBytes,
            savingsPercent
        }
    };
}

module.exports = {
    COURSE_IMAGE_WIDTH,
    COURSE_IMAGE_HEIGHT,
    COURSE_IMAGE_MAX_BYTES,
    COURSE_IMAGE_QUALITY,
    COURSE_IMAGE_MIN_QUALITY,
    webpPath,
    remapAnalysisAssetPaths,
    optimizeCourseImage,
    optimizeCourseMedia
};
