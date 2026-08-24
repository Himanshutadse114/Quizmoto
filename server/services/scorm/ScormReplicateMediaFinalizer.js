const JSZip = require('jszip');
const { buildScormPackageZip: buildLegacyPackage } = require('./ScormAnswerTrackingPackageFinalizer');
const { buildScormPackageZip: buildCanonicalRasterPackage } = require('./ScormCanonicalRasterPackageBuilder');

/**
 * IMPORTANT: raster-authored AI courses no longer use this CSS/script at runtime.
 * They are retained only for backwards-compatible tests/debug tooling. The
 * production raster path now goes directly to ScormCanonicalRasterPackageBuilder.
 */
const REPLICATE_MEDIA_CSS = `
<style id="quizmoto-replicate-media-v3">
.qmx-raster-frame,.qmx-raster-panel,.qmx-cover-raster{position:relative;width:100%;aspect-ratio:16/9;height:auto;overflow:hidden;border-radius:22px}
.qmx-replicate-raster{display:block;width:100%;height:100%;object-fit:cover}
</style>`;

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
    const packagedPaths = new Set((Array.isArray(mediaFiles) ? mediaFiles : []).map((file) => String(file?.path || '').trim()).filter(Boolean));
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

    const uniqueRequired = [...new Set(required)];
    const missing = uniqueRequired.filter((path) => !path.startsWith('data:image/') && !packagedPaths.has(path));
    if (missing.length) {
        const err = new Error(`Raster course references image files that are not packaged: ${missing.join(', ')}`);
        err.code = 'SCORM_RASTER_MAPPING_INVALID';
        err.missingPaths = missing;
        throw err;
    }

    const generated = [...packagedPaths].filter((path) => isRasterPath(path));
    const unused = generated.filter((path) => !uniqueRequired.includes(path));
    if (unused.length) {
        const err = new Error(`Generated course images are not mapped to the learner course: ${unused.join(', ')}`);
        err.code = 'SCORM_RASTER_UNMAPPED_MEDIA';
        err.unusedPaths = unused;
        throw err;
    }

    return { raster: true, paths: uniqueRequired };
}

/**
 * Deprecated legacy helper. Keep it syntactically valid so archived packages
 * or unit tests never reproduce the old malformed-regex failure. New raster
 * packages do not call this function.
 */
function replicateMediaScript(assetMap = {}) {
    const safeMap = JSON.stringify(assetMap || {}).replace(/</g, '\\u003c');
    return `
<script id="quizmoto-replicate-media-script-v3">
(function(){
  var ASSETS=${safeMap};
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function src(path){path=String(path||'');return ASSETS[path]||path}
  function install(){
    var data=window.__quizmotoData||null;if(!data||!Array.isArray(data.slides))return false;
    var nodes=Array.prototype.slice.call(document.querySelectorAll('.slide'));
    data.slides.forEach(function(s,i){
      var path=String((s&&s.visualAsset)||(s&&s.rasterVisualAsset)||'');if(!path)return;
      var node=nodes[i+1];if(!node)return;
      var target=node.querySelector('.qmx-raster-panel,.qmx-hub-art,.spot-visual,.hero-art');
      if(!target){target=document.createElement('div');target.className='qmx-raster-panel';(node.querySelector('.stage')||node).appendChild(target)}
      target.innerHTML='<img class="qmx-replicate-raster" src="'+esc(src(path))+'" alt="'+esc(s.visualTitle||s.title||'Learning image')+'">';
    });
    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function injectReplicateMediaUi(html, assetMap = {}) {
    let source = String(html || '');
    if (!source.includes('quizmoto-replicate-media-v3')) {
        source = source.includes('</head>')
            ? source.replace('</head>', () => `${REPLICATE_MEDIA_CSS}\n</head>`)
            : `${REPLICATE_MEDIA_CSS}\n${source}`;
    }
    if (!source.includes('quizmoto-replicate-media-script-v3')) {
        const script = replicateMediaScript(assetMap);
        source = source.includes('</body>')
            ? source.replace('</body>', () => `${script}\n</body>`)
            : `${source}\n${script}`;
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

async function appendLegacyMedia(baseBuffer, mediaFiles) {
    if (!mediaFiles.length) return baseBuffer;
    const zip = await JSZip.loadAsync(baseBuffer);
    mediaFiles.forEach((file) => {
        if (file?.path && file?.body) zip.file(String(file.path), file.body);
    });
    const manifestFile = zip.file('imsmanifest.xml');
    if (manifestFile) {
        const manifest = await manifestFile.async('string');
        zip.file('imsmanifest.xml', injectManifestFiles(manifest, mediaFiles.map((file) => file.path)));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function buildScormPackageZip(analysis, opts = {}) {
    const mediaFiles = Array.isArray(opts.replicateMediaFiles) ? opts.replicateMediaFiles : [];
    const validation = validateRasterMedia(analysis, mediaFiles);

    if (validation.raster) {
        // Authoritative AI-course path. Images are written directly into the
        // learner HTML by the canonical builder; no SVG renderer, post-render
        // image injector, MutationObserver or cover-removal finalizer runs.
        return buildCanonicalRasterPackage(analysis, {
            ...opts,
            replicateMediaFiles: mediaFiles
        });
    }

    const baseBuffer = await buildLegacyPackage(analysis, opts);
    return appendLegacyMedia(baseBuffer, mediaFiles);
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
