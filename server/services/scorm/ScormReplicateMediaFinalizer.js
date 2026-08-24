const JSZip = require('jszip');
const { buildScormPackageZip: buildBasePackage } = require('./ScormAnswerTrackingPackageFinalizer');

const REPLICATE_MEDIA_CSS = `
<style id="quizmoto-replicate-media-v2">
.slide.qmx-cover-slide .hero{
  min-height:640px!important;
  padding:42px 56px 36px!important;
  justify-content:center!important;
}
.slide.qmx-cover-slide .title{font-size:50px!important;line-height:1.03!important;margin-bottom:18px!important}
.slide.qmx-cover-slide .lead{max-width:820px!important;font-size:16.5px!important;line-height:1.55!important}
.qmx-cover-raster{
  position:relative!important;display:block!important;width:min(760px,100%)!important;aspect-ratio:16/9!important;
  height:auto!important;min-height:0!important;margin:24px auto 0!important;border-radius:22px!important;
  border:1px solid rgba(40,40,36,.16)!important;background-position:center!important;background-repeat:no-repeat!important;
  background-size:cover!important;box-shadow:0 18px 42px rgba(40,40,36,.13)!important;overflow:hidden!important
}
.qmx-cover-raster:after{content:""!important;position:absolute!important;inset:0!important;display:block!important;pointer-events:none!important;background:linear-gradient(180deg,rgba(8,18,17,.01),rgba(8,18,17,.13))!important}
.slide.qmx-cover-slide .qmx-cover-meta{margin-top:16px!important}
.qmx-replicate-raster{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:inherit!important}
.qmx-raster-frame{
  width:100%!important;aspect-ratio:16/9!important;height:auto!important;min-height:0!important;max-height:none!important;
  overflow:hidden!important;border-radius:22px!important;position:relative!important
}
.qmx-raster-frame:before,.qmx-raster-frame:after{display:none!important}
.qmx-raster-frame svg{display:none!important}
.qmx-raster-stage{
  display:grid!important;grid-template-columns:minmax(0,1.12fr) minmax(300px,.88fr)!important;
  grid-template-areas:"head image" "body image"!important;column-gap:28px!important;row-gap:18px!important;align-items:start!important
}
.qmx-raster-stage > .section-head{grid-area:head!important;margin-bottom:0!important}
.qmx-raster-stage > .cards-grid,.qmx-raster-stage > .process,.qmx-raster-stage > .timeline,.qmx-raster-stage > .compare,.qmx-raster-stage > .hub-wrap{grid-area:body!important;min-width:0!important}
.qmx-raster-panel{
  grid-area:image!important;width:100%!important;aspect-ratio:16/9!important;height:auto!important;min-height:0!important;max-height:none!important;
  border-radius:22px!important;overflow:hidden!important;background:#D8D8D2!important;border:1px solid var(--gamma-paper-3,#CBC5B8)!important;
  box-shadow:0 16px 38px rgba(40,40,36,.10)!important;align-self:center!important
}
.qmx-raster-stage > .process,.qmx-raster-stage > .timeline{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:11px!important;padding-top:0!important;align-items:stretch!important}
.qmx-raster-stage > .timeline:before,.qmx-raster-stage > .process .step:after{display:none!important}
.qmx-raster-stage > .compare{grid-template-columns:1fr!important;gap:10px!important}
.qmx-raster-stage > .cards-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
.qmx-raster-stage .concept-card,.qmx-raster-stage .step{padding:14px!important;min-height:98px!important}
.qmx-static-card{cursor:default!important;perspective:none!important}
.qmx-static-card .qmx-flip-inner{transform:none!important;min-height:94px!important;transition:none!important}
.qmx-static-card .qmx-flip-front{display:none!important}
.qmx-static-card .qmx-flip-back{position:relative!important;inset:auto!important;transform:none!important;min-height:94px!important;background:rgba(255,255,255,.35)!important;border-color:var(--gamma-paper-3,#CBC5B8)!important}
.qmx-static-card .qmx-flip-hint{display:none!important}
.qmx-static-reveal{cursor:default!important}
.qmx-static-reveal .qmx-reveal-body{max-height:none!important;opacity:1!important;overflow:visible!important;margin-top:10px!important;transition:none!important}
.qmx-static-reveal .qmx-reveal-toggle{display:none!important}
.feedback.qmx-feedback-with-explanation{display:block!important;text-align:left!important;line-height:1.55!important;font-size:13px!important;font-weight:600!important;padding:14px 16px!important}
.feedback .qmx-feedback-status{display:block!important;font-weight:900!important;margin-bottom:5px!important}
.feedback .qmx-feedback-explanation{display:block!important;font-weight:600!important}
@media(max-width:980px){
  .slide.qmx-cover-slide .hero{min-height:600px!important;padding:38px 34px 32px!important}
  .slide.qmx-cover-slide .title{font-size:40px!important}.slide.qmx-cover-slide .lead{font-size:15.5px!important}
  .qmx-cover-raster{width:min(680px,100%)!important;margin-top:20px!important}
  .qmx-raster-stage{grid-template-columns:1fr!important;grid-template-areas:"head" "image" "body"!important;row-gap:18px!important}
}
@media(max-width:560px){
  .slide.qmx-cover-slide .hero{min-height:560px!important;padding:36px 18px 28px!important}
  .slide.qmx-cover-slide .title{font-size:31px!important;margin-bottom:14px!important}.slide.qmx-cover-slide .lead{font-size:14px!important;line-height:1.5!important}
  .qmx-cover-raster,.qmx-raster-panel,.qmx-raster-frame{border-radius:16px!important}
  .qmx-cover-raster{width:100%!important;margin-top:18px!important}
  .qmx-raster-stage > .process,.qmx-raster-stage > .timeline,.qmx-raster-stage > .cards-grid{grid-template-columns:1fr!important}
}
</style>`;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function replicateMediaScript(assetMap = {}) {
    const safeMap = JSON.stringify(assetMap || {}).replace(/</g, '\\u003c');
    return `
<script id="quizmoto-replicate-media-script-v2">
(function(){
  if(window.__quizmotoReplicateMediaV2)return;
  window.__quizmotoReplicateMediaV2=true;
  var ASSETS=${safeMap};
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function src(path){path=String(path||'');return ASSETS[path]||path}
  function cssUrl(path){return 'url("'+src(path).replace(/["\\]/g,'\\$&')+'")'}
  function imageHtml(s){var p=src(s.rasterVisualAsset);return '<img class="qmx-replicate-raster" src="'+esc(p)+'" alt="'+esc(s.visualTitle||s.title||'Learning image')+'" loading="eager" decoding="async">'}
  function installCover(intro,data){
    if(!intro||!data.coverImageAsset)return;
    var hero=intro.querySelector('.hero');if(!hero)return;
    var art=hero.querySelector('.qmx-cover-raster');
    if(!art){art=document.createElement('div');art.className='qmx-cover-raster';art.setAttribute('role','img');art.setAttribute('aria-label',String(data.title||'Course cover image'));var meta=hero.querySelector('.qmx-cover-meta');if(meta&&meta.parentNode===hero)hero.insertBefore(art,meta);else hero.appendChild(art)}
    art.style.backgroundImage=cssUrl(data.coverImageAsset);
    art.setAttribute('data-qmx-replicate-raster',String(data.coverImageAsset));
  }
  function installRasterSlides(slides,data){
    (data.slides||[]).forEach(function(s,i){
      if(!s||!s.rasterVisualAsset)return;
      var node=slides[i+1];if(!node)return;
      var path=String(s.rasterVisualAsset);
      var target=node.querySelector('.qmx-hub-art')||node.querySelector('.spot-visual')||node.querySelector('.hero-art');
      if(target){
        target.classList.add('qmx-raster-frame');
        if(target.getAttribute('data-qmx-replicate-raster')!==path){target.innerHTML=imageHtml(s);target.setAttribute('data-qmx-replicate-raster',path)}
        return;
      }
      var stage=node.querySelector('.stage,.qmx-stage')||node;
      var panel=stage.querySelector('.qmx-raster-panel');
      if(!panel){panel=document.createElement('div');panel.className='qmx-raster-panel';stage.appendChild(panel)}
      stage.classList.add('qmx-raster-stage');
      if(panel.getAttribute('data-qmx-replicate-raster')!==path){panel.innerHTML=imageHtml(s);panel.setAttribute('data-qmx-replicate-raster',path)}
    });
  }
  function normaliseInteractionDensity(slides,data){
    (data.slides||[]).forEach(function(s,i){var node=slides[i+1];if(!node)return;var type=String(s&&s.screenType||'concept').toLowerCase();if(type==='reveal'||type==='hotspot')return;node.querySelectorAll('.qmx-flip-card').forEach(function(card){card.classList.add('qmx-static-card')});node.querySelectorAll('.qmx-reveal-card').forEach(function(card){card.classList.add('qmx-static-reveal')})});
  }
  function installQuizExplanations(data){
    if(document.documentElement.getAttribute('data-qmx-quiz-explanation-v1'))return;
    document.documentElement.setAttribute('data-qmx-quiz-explanation-v1','1');
    document.addEventListener('click',function(event){var btn=event.target&&event.target.closest?event.target.closest('.quiz-option[data-qi][data-oi]'):null;if(!btn)return;var qi=Number(btn.getAttribute('data-qi')),oi=Number(btn.getAttribute('data-oi'));setTimeout(function(){var q=(data.quiz||[])[qi]||{},fb=document.getElementById('fb-'+qi);if(!fb)return;var explanation=String(q.explanation||'').trim();if(!explanation)return;var correct=Number(q.correctAnswer),status=oi===correct?'Correct':'Not quite';fb.classList.add('qmx-feedback-with-explanation');fb.innerHTML='<span class="qmx-feedback-status">'+esc(status)+'</span><span class="qmx-feedback-explanation">'+esc(explanation)+'</span>'},0)},false);
  }
  function install(){
    var data=window.__quizmotoData||null;if(!data||!Array.isArray(data.slides))return false;
    var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));if(!slides.length)return false;
    installCover(slides[0],data);installRasterSlides(slides,data);normaliseInteractionDensity(slides,data);installQuizExplanations(data);return true;
  }
  function run(){install();[80,220,520,950,1600,2600].forEach(function(ms){setTimeout(install,ms)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('load',function(){[0,120,500,1200].forEach(function(ms){setTimeout(install,ms)})},{once:true});
})();
</script>`;
}

function injectReplicateMediaUi(html, assetMap = {}) {
    let source = String(html || '');
    if (!source.includes('quizmoto-replicate-media-v2')) {
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
    const baseBuffer = await buildBasePackage(analysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);
    const mediaFiles = Array.isArray(opts.replicateMediaFiles) ? opts.replicateMediaFiles : [];

    mediaFiles.forEach((file) => {
        if (!file || !file.path || !file.body) return;
        zip.file(String(file.path), file.body);
    });

    const assetMap = buildEmbeddedMediaMap(mediaFiles);
    const indexFile = zip.file('index.html');
    if (indexFile) {
        const html = await indexFile.async('string');
        zip.file('index.html', injectReplicateMediaUi(html, assetMap));
    }

    const manifestFile = zip.file('imsmanifest.xml');
    if (manifestFile && mediaFiles.length) {
        const manifest = await manifestFile.async('string');
        zip.file('imsmanifest.xml', injectManifestFiles(manifest, mediaFiles.map((file) => file.path)));
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    injectReplicateMediaUi,
    injectManifestFiles,
    buildEmbeddedMediaMap,
    replicateMediaScript,
    REPLICATE_MEDIA_CSS
};
