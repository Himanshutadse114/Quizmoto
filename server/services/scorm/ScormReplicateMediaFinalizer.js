const JSZip = require('jszip');
const { buildScormPackageZip: buildLegacyPackage } = require('./ScormAnswerTrackingPackageFinalizer');
const { buildRasterCoursePackageZip } = require('./ScormRasterCoursePackageBuilder');
const { injectCourseInteractionsUi } = require('./ScormCourseInteractionService');

const REPLICATE_MEDIA_CSS = '<style id="quizmoto-replicate-media-v3"></style>';
const BROWSER_NARRATION_SCRIPT_ID = 'quizmoto-browser-narration-v2';
const COURSE_TYPOGRAPHY_STYLE_ID = 'quizmoto-course-typography-v1';

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

function courseTypographyStyle() {
    return `<style id="${COURSE_TYPOGRAPHY_STYLE_ID}">
/* Keep learner courses readable without overly heavy headings or answer text. */
header h1,
.progress-text,
.part,
.nav-btn,
.qmx-meta span { font-weight: 600 !important; }

.eyebrow { font-weight: 700 !important; }

.qmx-copy h2,
.qmx-quiz-shell h2,
.qmx-final-shell h2 { font-weight: 600 !important; }

.qmx-card p,
.qmx-step p,
.qmx-compare-col p,
.quiz-option,
.feedback { font-weight: 500 !important; }

.feedback strong,
.qmx-compare-col b { font-weight: 600 !important; }
</style>`;
}

function injectCourseTypographyUi(html) {
    let source = String(html || '');
    if (!source || source.includes(COURSE_TYPOGRAPHY_STYLE_ID)) return source;
    const style = courseTypographyStyle();
    return source.includes('</head>') ? source.replace('</head>', `${style}\n</head>`) : `${style}\n${source}`;
}

function browserNarrationScript() {
    return `<script id="${BROWSER_NARRATION_SCRIPT_ID}">
(function(){
  if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') return;

  var synth = window.speechSynthesis;
  var enabled = false;
  var lastSlide = null;
  var observer = null;

  function cleanText(value) {
    return String(value || '').replace(/\\s+/g, ' ').trim();
  }

  function activeSlide() {
    return document.querySelector('.slide.active');
  }

  function shortenParagraph(value) {
    var source = cleanText(value);
    if (!source) return '';
    var words = source.split(/\\s+/).filter(Boolean);
    if (words.length < 75) return source;

    var reduction = words.length >= 150 ? 42 : (words.length >= 110 ? 36 : 28);
    var target = Math.max(55, words.length - reduction);
    var sentences = source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [source];
    var selected = [];
    var count = 0;

    for (var i = 0; i < sentences.length; i += 1) {
      var sentence = cleanText(sentences[i]);
      if (!sentence) continue;
      var sentenceWords = sentence.split(/\\s+/).filter(Boolean).length;
      if (selected.length >= 2 && count + sentenceWords > target) break;
      selected.push(sentence);
      count += sentenceWords;
      if (count >= target) break;
    }

    if (!selected.length || count < Math.max(40, target - 20)) {
      var clipped = words.slice(0, target).join(' ').replace(/[,:;\\-]+$/, '').trim();
      return /[.!?]$/.test(clipped) ? clipped : clipped + '.';
    }
    return cleanText(selected.join(' '));
  }

  function shortenLearningParagraphs() {
    Array.prototype.forEach.call(document.querySelectorAll('.slide[data-kind="learning"] .qmx-copy > p'), function(node){
      if (!node || node.getAttribute('data-qmx-shortened') === 'true') return;
      node.textContent = shortenParagraph(node.textContent);
      node.setAttribute('data-qmx-shortened', 'true');
    });
  }

  function narrationText(slide) {
    if (!slide) return '';
    var selectors = [
      '.eyebrow',
      'h2',
      '.qmx-copy > p',
      '.qmx-card p',
      '.qmx-step p',
      '.qmx-compare-col p',
      '.quiz-option',
      '.feedback',
      '.qmx-final-shell > p'
    ];
    var seen = [];
    selectors.forEach(function(selector){
      Array.prototype.forEach.call(slide.querySelectorAll(selector), function(node){
        if (node.classList && node.classList.contains('feedback') && window.getComputedStyle(node).display === 'none') return;
        var value = cleanText(node.textContent);
        if (value && seen.indexOf(value) === -1) seen.push(value);
      });
    });
    if (!seen.length) return cleanText(slide.innerText || slide.textContent);
    return seen.join('. ');
  }

  function chooseVoice(lang) {
    var voices = synth.getVoices ? synth.getVoices() : [];
    if (!voices || !voices.length) return null;
    var requested = cleanText(lang || document.documentElement.lang || navigator.language || 'en-US').toLowerCase();
    var base = requested.split('-')[0];
    var candidates = voices.filter(function(voice){
      return String(voice.lang || '').toLowerCase().indexOf(base) === 0;
    });
    if (!candidates.length) candidates = voices.slice();
    candidates.sort(function(a, b){
      function score(voice) {
        var name = String(voice.name || '');
        var voiceLang = String(voice.lang || '').toLowerCase();
        var total = 0;
        if (/natural|neural|premium|enhanced|online/i.test(name)) total += 140;
        if (/google/i.test(name)) total += 90;
        if (/aria|jenny|ava|sonia|ryan|emma|brian|samantha|karen|daniel|serena|moira/i.test(name)) total += 55;
        if (/espeak|compact|robot|classic/i.test(name)) total -= 80;
        if (voiceLang === requested) total += 25;
        else if (voiceLang.indexOf(base) === 0) total += 12;
        return total;
      }
      return score(b) - score(a);
    });
    return candidates[0] || null;
  }

  function updateButton() {
    var button = document.getElementById('qmx-narration-toggle');
    if (!button) return;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.textContent = enabled ? 'Narration On' : 'Narration Off';
    button.title = enabled ? 'Stop automatic narration' : 'Read this course aloud';
    button.style.background = enabled ? '#282824' : 'transparent';
    button.style.color = enabled ? '#fff' : '#282824';
  }

  function stopNarration() {
    try { synth.cancel(); } catch (_) {}
  }

  function speakWithBestVoice(utterance, lang) {
    var started = false;
    var start = function(){
      if (started) return;
      started = true;
      var voice = chooseVoice(lang);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || lang;
      }
      try { synth.speak(utterance); } catch (_) {}
    };

    var voices = synth.getVoices ? synth.getVoices() : [];
    if (voices && voices.length) {
      start();
      return;
    }

    if (typeof synth.addEventListener === 'function') {
      try { synth.addEventListener('voiceschanged', start, { once: true }); } catch (_) {}
    }
    window.setTimeout(start, 500);
  }

  function speakCurrentSlide(force) {
    if (!enabled) return;
    var slide = activeSlide();
    if (!slide) return;
    if (!force && slide === lastSlide) return;
    lastSlide = slide;
    var spoken = narrationText(slide);
    if (!spoken) return;
    stopNarration();
    var utterance = new SpeechSynthesisUtterance(spoken);
    var lang = document.documentElement.lang || navigator.language || 'en-US';
    utterance.lang = lang;
    utterance.rate = 0.86;
    utterance.pitch = 0.98;
    utterance.volume = 1;
    speakWithBestVoice(utterance, lang);
  }

  function install() {
    shortenLearningParagraphs();
    var header = document.querySelector('header');
    if (!header || document.getElementById('qmx-narration-toggle')) return;
    var button = document.createElement('button');
    button.id = 'qmx-narration-toggle';
    button.type = 'button';
    button.setAttribute('aria-label', 'Toggle course narration');
    button.style.minHeight = '34px';
    button.style.padding = '6px 10px';
    button.style.border = '1px solid rgba(40,40,36,.28)';
    button.style.borderRadius = '8px';
    button.style.fontSize = '11px';
    button.style.fontWeight = '600';
    button.style.cursor = 'pointer';
    button.style.whiteSpace = 'nowrap';
    button.style.flexShrink = '0';
    button.addEventListener('click', function(){
      enabled = !enabled;
      updateButton();
      if (enabled) {
        lastSlide = null;
        speakCurrentSlide(true);
      } else {
        stopNarration();
      }
    });
    header.appendChild(button);
    updateButton();

    var main = document.querySelector('main');
    if (main && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(function(){
        shortenLearningParagraphs();
        if (!enabled) return;
        var slide = activeSlide();
        if (slide && slide !== lastSlide) speakCurrentSlide(false);
      });
      observer.observe(main, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();

  window.addEventListener('pagehide', stopNarration);
  window.addEventListener('beforeunload', stopNarration);
})();
</script>`;
}

function injectBrowserNarrationUi(html) {
    let source = String(html || '');
    if (!source || source.includes(BROWSER_NARRATION_SCRIPT_ID)) return source;
    const script = browserNarrationScript();
    return source.includes('</body>') ? source.replace('</body>', `${script}\n</body>`) : `${source}\n${script}`;
}

async function addBrowserNarrationToZip(zipBuffer) {
    const zip = await JSZip.loadAsync(zipBuffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return zipBuffer;
    let html = await indexFile.async('string');
    html = injectCourseTypographyUi(html);
    html = injectCourseInteractionsUi(html);
    html = injectBrowserNarrationUi(html);
    zip.file('index.html', html);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
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
        const rasterZip = await buildRasterCoursePackageZip(analysis, {
            templateId: opts.templateId,
            logoDataUrl: opts.logoDataUrl || null,
            mediaFiles
        });
        return addBrowserNarrationToZip(rasterZip);
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
    courseTypographyStyle,
    injectCourseTypographyUi,
    browserNarrationScript,
    injectBrowserNarrationUi,
    addBrowserNarrationToZip,
    COURSE_TYPOGRAPHY_STYLE_ID,
    BROWSER_NARRATION_SCRIPT_ID,
    REPLICATE_MEDIA_CSS
};
