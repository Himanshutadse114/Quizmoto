const JSZip = require('jszip');
const { buildScormPackageZip: buildBasePackage } = require('./ScormAnswerTrackingPackageFinalizer');

const REPLICATE_MEDIA_CSS = `
<style id="quizmoto-replicate-media-v2">
/* Outermost learner visual layer. Replicate media is packaged WebP only. */
.slide.qmx-cover-slide .hero{
  min-height:640px!important;
  padding:42px 56px 36px!important;
  justify-content:center!important;
}
.slide.qmx-cover-slide .title{
  font-size:50px!important;
  line-height:1.03!important;
  margin-bottom:18px!important;
}
.slide.qmx-cover-slide .lead{
  max-width:820px!important;
  font-size:16.5px!important;
  line-height:1.55!important;
}
.qmx-cover-raster{
  position:relative!important;
  display:block!important;
  width:min(920px,100%)!important;
  height:250px!important;
  min-height:250px!important;
  margin:24px auto 0!important;
  border-radius:22px!important;
  border:1px solid rgba(40,40,36,.16)!important;
  background-position:center!important;
  background-repeat:no-repeat!important;
  background-size:cover!important;
  box-shadow:0 18px 42px rgba(40,40,36,.13)!important;
  overflow:hidden!important;
}
.qmx-cover-raster:after{
  content:""!important;
  position:absolute!important;
  inset:0!important;
  display:block!important;
  pointer-events:none!important;
  background:linear-gradient(180deg,rgba(8,18,17,.02),rgba(8,18,17,.16))!important;
}
.slide.qmx-cover-slide .qmx-cover-meta{margin-top:16px!important}
.qmx-replicate-raster{
  display:block!important;
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
  border-radius:inherit!important;
}

/* Any learning layout can now display a generated image. Cards/process/timeline/
   comparison previously had no raster target, so generated files were invisible. */
.qmx-raster-stage{
  display:grid!important;
  grid-template-columns:minmax(0,1.12fr) minmax(300px,.88fr)!important;
  grid-template-areas:"head image" "body image"!important;
  column-gap:28px!important;
  row-gap:18px!important;
  align-items:start!important;
}
.qmx-raster-stage > .section-head{grid-area:head!important;margin-bottom:0!important}
.qmx-raster-stage > .cards-grid,
.qmx-raster-stage > .process,
.qmx-raster-stage > .timeline,
.qmx-raster-stage > .compare,
.qmx-raster-stage > .hub-wrap{grid-area:body!important;min-width:0!important}
.qmx-raster-panel{
  grid-area:image!important;
  width:100%!important;
  height:420px!important;
  min-height:360px!important;
  border-radius:22px!important;
  overflow:hidden!important;
  background:#D8D8D2!important;
  border:1px solid var(--gamma-paper-3,#CBC5B8)!important;
  box-shadow:0 16px 38px rgba(40,40,36,.10)!important;
  align-self:center!important;
}

/* Only intentionally interactive slides stay flip/reveal based. */
.qmx-static-card{cursor:default!important;perspective:none!important}
.qmx-static-card .qmx-flip-inner{transform:none!important;min-height:94px!important;transition:none!important}
.qmx-static-card .qmx-flip-front{display:none!important}
.qmx-static-card .qmx-flip-back{
  position:relative!important;inset:auto!important;transform:none!important;min-height:94px!important;
  background:rgba(255,255,255,.35)!important;border-color:var(--gamma-paper-3,#CBC5B8)!important
}
.qmx-static-card .qmx-flip-hint{display:none!important}
.qmx-static-reveal{cursor:default!important}
.qmx-static-reveal .qmx-reveal-body{
  max-height:none!important;opacity:1!important;overflow:visible!important;margin-top:10px!important;transition:none!important
}
.qmx-static-reveal .qmx-reveal-toggle{display:none!important}

/* Knowledge-check feedback is instructional, not just right/wrong status. */
.feedback.qmx-feedback-with-explanation{
  display:block!important;
  text-align:left!important;
  line-height:1.55!important;
  font-size:13px!important;
  font-weight:600!important;
  padding:14px 16px!important;
}
.feedback .qmx-feedback-status{display:block!important;font-weight:900!important;margin-bottom:5px!important}
.feedback .qmx-feedback-explanation{display:block!important;font-weight:600!important}

@media(max-width:980px){
  .slide.qmx-cover-slide .hero{min-height:600px!important;padding:38px 34px 32px!important}
  .slide.qmx-cover-slide .title{font-size:40px!important}
  .slide.qmx-cover-slide .lead{font-size:15.5px!important}
  .qmx-cover-raster{height:230px!important;min-height:230px!important;margin-top:20px!important}
  .qmx-raster-stage{grid-template-columns:1fr!important;grid-template-areas:"head" "image" "body"!important;row-gap:18px!important}
  .qmx-raster-panel{height:300px!important;min-height:260px!important}
}
@media(max-width:560px){
  .slide.qmx-cover-slide .hero{min-height:560px!important;padding:36px 18px 28px!important}
  .slide.qmx-cover-slide .title{font-size:31px!important;margin-bottom:14px!important}
  .slide.qmx-cover-slide .lead{font-size:14px!important;line-height:1.5!important}
  .qmx-cover-raster{height:185px!important;min-height:185px!important;border-radius:16px!important;margin-top:18px!important}
  .qmx-raster-panel{height:220px!important;min-height:200px!important;border-radius:16px!important}
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

function replicateMediaScript() {
    return `
<script id="quizmoto-replicate-media-script-v2">
(function(){
  if(window.__quizmotoReplicateMediaV2)return;
  window.__quizmotoReplicateMediaV2=true;
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function cssUrl(path){return 'url("'+String(path||'').replace(/["\\]/g,'\\$&')+'")'}
  function imageHtml(s){return '<img class="qmx-replicate-raster" src="'+esc(s.rasterVisualAsset)+'" alt="'+esc(s.visualTitle||s.title||'Learning image')+'" decoding="async">'}
  function installCover(intro,data){
    if(!intro||!data.coverImageAsset)return;
    var hero=intro.querySelector('.hero');if(!hero)return;
    var art=hero.querySelector('.qmx-cover-raster');
    if(!art){
      art=document.createElement('div');
      art.className='qmx-cover-raster';
      art.setAttribute('role','img');
      art.setAttribute('aria-label',String(data.title||'Course cover image'));
      var meta=hero.querySelector('.qmx-cover-meta');
      if(meta&&meta.parentNode===hero)hero.insertBefore(art,meta);else hero.appendChild(art);
    }
    art.style.backgroundImage=cssUrl(data.coverImageAsset);
  }
  function installRasterSlides(slides,data){
    (data.slides||[]).forEach(function(s,i){
      if(!s||!s.rasterVisualAsset)return;
      var node=slides[i+1];if(!node)return;
      var target=node.querySelector('.qmx-hub-art')||node.querySelector('.spot-visual')||node.querySelector('.hero-art')||node.querySelector('.hero-core');
      if(target){
        if(target.getAttribute('data-qmx-replicate-raster')===String(s.rasterVisualAsset))return;
        target.innerHTML=imageHtml(s);
        target.setAttribute('data-qmx-replicate-raster',String(s.rasterVisualAsset));
        return;
      }
      var stage=node.querySelector('.stage,.qmx-stage');if(!stage)return;
      var panel=stage.querySelector('.qmx-raster-panel');
      if(!panel){panel=document.createElement('div');panel.className='qmx-raster-panel';stage.appendChild(panel)}
      stage.classList.add('qmx-raster-stage');
      if(panel.getAttribute('data-qmx-replicate-raster')!==String(s.rasterVisualAsset)){
        panel.innerHTML=imageHtml(s);
        panel.setAttribute('data-qmx-replicate-raster',String(s.rasterVisualAsset));
      }
    });
  }
  function normaliseInteractionDensity(slides,data){
    (data.slides||[]).forEach(function(s,i){
      var node=slides[i+1];if(!node)return;
      var type=String(s&&s.screenType||'concept').toLowerCase();
      var keepInteractive=type==='reveal'||type==='hotspot';
      if(keepInteractive)return;
      node.querySelectorAll('.qmx-flip-card').forEach(function(card){card.classList.add('qmx-static-card')});
      node.querySelectorAll('.qmx-reveal-card').forEach(function(card){card.classList.add('qmx-static-reveal')});
    });
  }
  function installQuizExplanations(data){
    if(document.documentElement.getAttribute('data-qmx-quiz-explanation-v1'))return;
    document.documentElement.setAttribute('data-qmx-quiz-explanation-v1','1');
    document.addEventListener('click',function(event){
      var btn=event.target&&event.target.closest?event.target.closest('.quiz-option[data-qi][data-oi]'):null;if(!btn)return;
      var qi=Number(btn.getAttribute('data-qi')),oi=Number(btn.getAttribute('data-oi'));
      setTimeout(function(){
        var q=(data.quiz||[])[qi]||{},fb=document.getElementById('fb-'+qi);if(!fb)return;
        var explanation=String(q.explanation||'').trim();if(!explanation)return;
        var correct=Number(q.correctAnswer),status=oi===correct?'Correct':'Not quite';
        fb.classList.add('qmx-feedback-with-explanation');
        fb.innerHTML='<span class="qmx-feedback-status">'+esc(status)+'</span><span class="qmx-feedback-explanation">'+esc(explanation)+'</span>';
      },0);
    },false);
  }
  function install(){
    var data=window.__quizmotoData||null;if(!data||!Array.isArray(data.slides))return false;
    var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));if(!slides.length)return false;
    installCover(slides[0],data);
    installRasterSlides(slides,data);
    normaliseInteractionDensity(slides,data);
    installQuizExplanations(data);
    return true;
  }
  function run(){install();[180,520,1100,1800].forEach(function(ms){setTimeout(install,ms)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('load',function(){setTimeout(install,90)},{once:true});
})();
</script>`;
}

function injectReplicateMediaUi(html) {
    let source = String(html || '');
    if (!source.includes('quizmoto-replicate-media-v2')) {
        source = source.includes('</head>') ? source.replace('</head>', `${REPLICATE_MEDIA_CSS}\n</head>`) : `${REPLICATE_MEDIA_CSS}\n${source}`;
    }
    if (!source.includes('quizmoto-replicate-media-script-v2')) {
        const script = replicateMediaScript();
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

    const indexFile = zip.file('index.html');
    if (indexFile) {
        const html = await indexFile.async('string');
        zip.file('index.html', injectReplicateMediaUi(html));
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
    replicateMediaScript,
    REPLICATE_MEDIA_CSS
};
