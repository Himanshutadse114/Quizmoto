const JSZip = require('jszip');
const { buildScormPackageZip: buildLegacyPackage } = require('./ScormAnswerTrackingPackageFinalizer');
const { buildRasterCoursePackageZip } = require('./ScormRasterCoursePackageBuilder');

const REPLICATE_MEDIA_CSS = '<style id="quizmoto-replicate-media-v3"></style>';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isRasterPath(value) {
    const path = String(value || '').trim().toLowerCase();
    return /\.(webp|png|jpe?g)(?:$|[?#])/.test(path) || path.startsWith('data:image/webp') || path.startsWith('data:image/png') || path.startsWith('data:image/jpeg');
}

function buildEmbeddedMediaMap(mediaFiles) {
    const result = {};
    for (const file of Array.isArray(mediaFiles) ? mediaFiles : []) {
        if (!file || !file.path || !file.body) continue;
        const contentType = String(file.contentType || 'image/webp');
        const body = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body);
        result[String(file.path)] = `data:${contentType};base64,${body.toString('base64')}`;
    }
    return result;
}

function validateRasterMedia(analysis, mediaFiles) {
    if (String(analysis?.visualMode || '').toLowerCase() !== 'raster') return { raster: false, paths: [] };
    const packagedPaths = new Set((Array.isArray(mediaFiles) ? mediaFiles : [])
        .map((file) => String(file?.path || '').trim())
        .filter(Boolean));
    const required = [];
    const cover = String(analysis?.coverVisualAsset || analysis?.coverImageAsset || '').trim();
    if (!cover || !isRasterPath(cover)) {
        const err = new Error('Raster course cover is missing a canonical image asset.');
        err.code = 'SCORM_RASTER_MAPPING_INVALID';
        throw err;
    }
    required.push(cover);

    for (const [index, slide] of (Array.isArray(analysis?.slides) ? analysis.slides : []).entries()) {
        const visual = String(slide?.visualAsset || slide?.rasterVisualAsset || '').trim();
        if (!visual) continue;
        if (!isRasterPath(visual) || /\.svg(?:$|[?#])/i.test(visual)) {
            const err = new Error(`Slide ${index + 1} points to a non-raster visual asset.`);
            err.code = 'SCORM_RASTER_MAPPING_INVALID';
            throw err;
        }
        required.push(visual);
    }

    const missing = [...new Set(required)].filter((path) => !path.startsWith('data:image/') && !packagedPaths.has(path));
    if (missing.length) {
        const err = new Error(`Raster course references image files that are not packaged: ${missing.join(', ')}`);
        err.code = 'SCORM_RASTER_MAPPING_INVALID';
        err.missingPaths = missing;
        throw err;
    }
    return { raster: true, paths: [...new Set(required)] };
}

function replicateMediaScript(assetMap = {}) {
    const safeMap = JSON.stringify(assetMap || {}).replace(/</g, '\\u003c');
    return `<script id="quizmoto-replicate-media-script-v2">window.__quizmotoDeprecatedRasterAssets=${safeMap};</script>`;
}

function injectReplicateMediaUi(html, assetMap = {}) {
    let source = String(html || '');
    if (!source.includes('quizmoto-replicate-media-v3')) {
        source = source.includes('</head>') ? source.replace('</head>', `${REPLICATE_MEDIA_CSS}\n</head>`) : `${REPLICATE_MEDIA_CSS}\n${source}`;
    }
    if (!source.includes('quizmoto-replicate-media-script-v2')) {
        const script = replicateMediaScript(assetMap);
        source = source.includes('</body>') ? source.replace('</body>', `${script}\n</body>`) : `${source}\n${script}`;
    }
    return source;
}

function injectManifestFiles(manifest, paths) {
    let source = String(manifest || '');
    const unique = Array.from(new Set((paths || []).map((path) => String(path || '').trim()).filter(Boolean)));
    if (!unique.length || !source.includes('</resource>')) return source;
    const files = unique
        .filter((path) => !source.includes(`href="${escapeHtml(path)}"`))
        .map((path) => `    <file href="${escapeHtml(path)}"/>`)
        .join('\n');
    if (!files) return source;
    return source.replace('</resource>', `${files}\n  </resource>`);
}

async function buildScormPackageZip(analysis, opts = {}) {
    const mediaFiles = Array.isArray(opts.replicateMediaFiles) ? opts.replicateMediaFiles : [];
    const validation = validateRasterMedia(analysis, mediaFiles);

    if (validation.raster) {
        return buildRasterCoursePackageZip(analysis, {
            templateId: opts.templateId,
            logoDataUrl: opts.logoDataUrl || null,
            mediaFiles
        });
    }

    return buildLegacyPackage(analysis, opts);
}

module.exports = {
    buildScormPackageZip,
    injectReplicateMediaUi,
    injectManifestFiles,
    buildEmbeddedMediaMap,
    replicateMediaScript,
    validateRasterMedia,
    isRasterPath,
    REPLICATE_MEDIA_CSS
};
