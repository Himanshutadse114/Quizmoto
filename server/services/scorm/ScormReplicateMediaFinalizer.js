const JSZip = require('jszip');
const { buildScormPackageZip: buildBasePackage } = require('./ScormAnswerTrackingPackageFinalizer');

const REPLICATE_MEDIA_CSS = `
<style id="quizmoto-replicate-media-v1">
/* This layer is intentionally after the SVG finalizer. Replicate media uses
   packaged WebP assets so the front page never depends on SVG. */
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
.qmx-replicate-raster{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:inherit!important}
@media(max-width:980px){
  .slide.qmx-cover-slide .hero{min-height:600px!important;padding:38px 34px 32px!important}
  .slide.qmx-cover-slide .title{font-size:40px!important}
  .slide.qmx-cover-slide .lead{font-size:15.5px!important}
  .qmx-cover-raster{height:230px!important;min-height:230px!important;margin-top:20px!important}
}
@media(max-width:560px){
  .slide.qmx-cover-slide .hero{min-height:560px!important;padding:36px 18px 28px!important}
  .slide.qmx-cover-slide .title{font-size:31px!important;margin-bottom:14px!important}
  .slide.qmx-cover-slide .lead{font-size:14px!important;line-height:1.5!important}
  .qmx-cover-raster{height:185px!important;min-height:185px!important;border-radius:16px!important;margin-top:18px!important}
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
<script id="quizmoto-replicate-media-script-v1">
(function(){
  if(window.__quizmotoReplicateMediaV1)return;
  window.__quizmotoReplicateMediaV1=true;
  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function cssUrl(path){return 'url("'+String(path||'').replace(/["\\]/g,'\\$&')+'")'}
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
      if(!target)return;
      if(target.getAttribute('data-qmx-replicate-raster')===String(s.rasterVisualAsset))return;
      target.innerHTML='<img class="qmx-replicate-raster" src="'+esc(s.rasterVisualAsset)+'" alt="'+esc(s.visualTitle||s.title||'Learning image')+'" decoding="async">';
      target.setAttribute('data-qmx-replicate-raster',String(s.rasterVisualAsset));
    });
  }
  function install(){
    var data=window.__quizmotoData||null;if(!data||!Array.isArray(data.slides))return false;
    var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));if(!slides.length)return false;
    installCover(slides[0],data);
    installRasterSlides(slides,data);
    return true;
  }
  function run(){
    install();
    /* The previous visual guard retries up to 900ms. Re-apply raster media
       after those passes so a late SVG fallback can never replace Replicate. */
    [140,460,1080,1600].forEach(function(ms){setTimeout(install,ms)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('load',function(){setTimeout(install,80)},{once:true});
})();
</script>`;
}

function injectReplicateMediaUi(html) {
    let source = String(html || '');
    if (!source.includes('quizmoto-replicate-media-v1')) {
        source = source.includes('</head>') ? source.replace('</head>', `${REPLICATE_MEDIA_CSS}\n</head>`) : `${REPLICATE_MEDIA_CSS}\n${source}`;
    }
    if (!source.includes('quizmoto-replicate-media-script-v1')) {
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
