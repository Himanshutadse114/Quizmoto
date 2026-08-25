const JSZip = require('jszip');

const COVER_FIELDS = [
    'coverImageAsset',
    'coverVisualAsset',
    'coverMobileVisualAsset',
    'coverImagePrompt',
    'coverImagePromptProvider',
    'coverImagePromptModel',
    'visualMode',
    'visualProvider',
    'visualPromptProvider',
    'mediaProvider'
];

const SLIDE_VISUAL_FIELDS = [
    'rasterVisualAsset',
    'visualAsset',
    'mobileVisualAsset',
    'visualSource',
    'visualAssetType',
    'imagePrompt',
    'imagePromptProvider',
    'imagePromptModel'
];

function clean(value) {
    return String(value || '').trim();
}

function contentTypeForPath(path) {
    const value = clean(path).toLowerCase();
    if (value.endsWith('.png')) return 'image/png';
    if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/webp';
}

function parseAnalysis(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(String(value));
    } catch (_) {
        return null;
    }
}

function copyDefined(target, source, fields) {
    for (const field of fields) {
        if (source && source[field] !== undefined && source[field] !== null && source[field] !== '') {
            target[field] = source[field];
        }
    }
    return target;
}

function mergeExistingVisuals(nextAnalysis, previousAnalysis) {
    const next = nextAnalysis && typeof nextAnalysis === 'object' ? { ...nextAnalysis } : {};
    const previous = previousAnalysis && typeof previousAnalysis === 'object' ? previousAnalysis : {};

    copyDefined(next, previous, COVER_FIELDS);

    const previousSlides = Array.isArray(previous.slides) ? previous.slides : [];
    next.slides = (Array.isArray(next.slides) ? next.slides : []).map((slide, index) => {
        const merged = { ...(slide || {}) };
        copyDefined(merged, previousSlides[index] || {}, SLIDE_VISUAL_FIELDS);
        return merged;
    });

    next.visualMode = previous.visualMode || next.visualMode || 'raster';
    next.visualProvider = previous.visualProvider || next.visualProvider || 'replicate';
    next.visualPromptProvider = previous.visualPromptProvider || next.visualPromptProvider || 'gemini';
    next.mediaProvider = previous.mediaProvider || next.mediaProvider || 'replicate';
    return next;
}

function referencedRasterPaths(analysis) {
    const paths = [];
    const cover = clean(analysis?.coverVisualAsset || analysis?.coverImageAsset || analysis?.coverMobileVisualAsset);
    if (cover && !cover.startsWith('data:image/')) paths.push(cover);

    for (const slide of Array.isArray(analysis?.slides) ? analysis.slides : []) {
        const path = clean(slide?.visualAsset || slide?.rasterVisualAsset || slide?.mobileVisualAsset);
        if (path && !path.startsWith('data:image/')) paths.push(path);
    }

    return [...new Set(paths)];
}

function mediaReuseError(message) {
    const err = new Error(message);
    err.code = 'SCORM_REBUILD_MEDIA_MISSING';
    err.status = 409;
    return err;
}

async function reuseExistingCourseMedia({ pkg, analysis, storage, onProgress }) {
    if (!pkg) throw mediaReuseError('Package to rebuild was not found.');
    if (!pkg.storageKeyZip) throw mediaReuseError('The existing course ZIP is missing, so its visuals cannot be reused.');

    if (typeof onProgress === 'function') {
        onProgress({
            percent: 12,
            stage: 'Reusing existing course visuals',
            detail: 'Keeping the current course images while applying your text and quiz changes.'
        });
    }

    const zipBuffer = await storage.getObjectBuffer(pkg.storageKeyZip);
    const zip = await JSZip.loadAsync(zipBuffer);

    let previousAnalysis = parseAnalysis(pkg.analysisJson);
    if (!previousAnalysis) {
        const content = zip.file('content.json');
        if (content) previousAnalysis = parseAnalysis(await content.async('string'));
    }
    if (!previousAnalysis) {
        throw mediaReuseError('The existing course does not contain reusable visual metadata.');
    }

    const mergedAnalysis = mergeExistingVisuals(analysis, previousAnalysis);
    const paths = referencedRasterPaths(mergedAnalysis);
    const coverPath = clean(mergedAnalysis.coverVisualAsset || mergedAnalysis.coverImageAsset || mergedAnalysis.coverMobileVisualAsset);
    if (!coverPath) {
        throw mediaReuseError('The existing course cover image is missing. The rebuild was stopped instead of generating a new image.');
    }

    const files = [];
    for (const path of paths) {
        const entry = zip.file(path);
        if (!entry) {
            throw mediaReuseError(`Existing visual ${path} is missing from the course ZIP. The rebuild was stopped instead of generating a replacement image.`);
        }
        files.push({
            path,
            body: await entry.async('nodebuffer'),
            contentType: contentTypeForPath(path)
        });
    }

    const previousMetadata = previousAnalysis.replicateMedia && typeof previousAnalysis.replicateMedia === 'object'
        ? previousAnalysis.replicateMedia
        : {};
    const metadata = {
        ...previousMetadata,
        reusedOnRebuild: true,
        reusedImages: files.length,
        totalImagesGenerated: 0,
        estimatedImageCostUsd: 0
    };
    mergedAnalysis.replicateMedia = metadata;

    if (typeof onProgress === 'function') {
        onProgress({
            percent: 68,
            stage: 'Existing visuals preserved',
            detail: `${files.length} existing course image${files.length === 1 ? '' : 's'} reused. No new image generation was requested.`
        });
    }

    return { analysis: mergedAnalysis, files, metadata };
}

module.exports = {
    mergeExistingVisuals,
    referencedRasterPaths,
    reuseExistingCourseMedia
};
