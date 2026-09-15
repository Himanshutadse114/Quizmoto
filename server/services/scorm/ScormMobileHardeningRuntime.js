'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'quizmoto-mobile-course-responsive-v5';
const SCRIPT_ID = 'quizmoto-mobile-course-responsive-script-v5';
const LEGACY_STYLE_IDS = ['quizmoto-mobile-course-hardening-v4'];
const LEGACY_SCRIPT_IDS = ['quizmoto-mobile-course-hardening-script-v4'];

function style() {
    return `<style id="${STYLE_ID}">
/* Structural mobile layout for generated template courses. */
html.qmx-mobile-layout-v5,
html.qmx-mobile-layout-v5 body{
  width:var(--qmx-mobile-vw,100%)!important;max-width:var(--qmx-mobile-vw,100%)!important;min-width:0!important;
  margin:0!important;padding:0!important;overflow-x:hidden!important;box-sizing:border-box!important
}
html.qmx-mobile-layout-v5{height:100%!important;min-height:100%!important}
html.qmx-mobile-layout-v5 body{height:100%!important;min-height:100%!important;overflow-y:hidden!important;overscroll-behavior:none!important}
html.qmx-mobile-layout-v5 body *{box-sizing:border-box!important;min-width:0}
html.qmx-mobile-layout-v5 body img,html.qmx-mobile-layout-v5 body video,html.qmx-mobile-layout-v5 body canvas,html.qmx-mobile-layout-v5 body svg{max-width:100%!important}
html.qmx-mobile-layout-v5 body #app{
  width:100%!important;max-width:100%!important;min-width:0!important;height:100%!important;min-height:0!important;max-height:100%!important;
  display:flex!important;flex-direction:column!important;overflow:hidden!important
}
html.qmx-mobile-layout-v5 body header{
  width:100%!important;max-width:100%!important;height:auto!important;min-height:54px!important;max-height:none!important;
  padding:7px 10px!important;gap:8px!important;display:flex!important;align-items:center!important;flex:0 0 auto!important;overflow:hidden!important
}
html.qmx-mobile-layout-v5 body header .brand-mark{width:32px!important;height:32px!important;min-width:32px!important;flex:0 0 32px!important}
html.qmx-mobile-layout-v5 body header .qmx-brand-logo,html.qmx-mobile-layout-v5 body header>img{
  display:block!important;width:auto!important;max-width:84px!important;height:auto!important;max-height:30px!important;object-fit:contain!important;flex:0 0 auto!important
}
html.qmx-mobile-layout-v5 body header h1{
  flex:0 1 auto!important;min-width:0!important;max-width:32vw!important;margin:0!important;font-size:11px!important;line-height:1.2!important;
  font-weight:600!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
}
html.qmx-mobile-layout-v5 body header .progress-shell{height:5px!important;min-width:28px!important;max-width:none!important;flex:1 1 auto!important;margin-left:auto!important}
html.qmx-mobile-layout-v5 body header .progress-text{font-size:9px!important;line-height:1!important;white-space:nowrap!important;flex:0 0 auto!important}
html.qmx-mobile-layout-v5 body #qmx-narration-toggle{min-width:38px!important;max-width:86px!important;min-height:36px!important;padding:5px 7px!important;font-size:9px!important;overflow:hidden!important}

html.qmx-mobile-layout-v5 body main,
html.qmx-mobile-layout-v5 body #content-area,
html.qmx-mobile-layout-v5 body .qmx-course-main,
html.qmx-mobile-layout-v5 body .qmx-scenario-main{
  position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;flex:1 1 auto!important;
  overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important
}
html.qmx-mobile-layout-v5 body .qmx-course-body,html.qmx-mobile-layout-v5 body .qmx-scenario-body{
  display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important
}
html.qmx-mobile-layout-v5 body .qmx-course-sidebar,html.qmx-mobile-layout-v5 body .qmx-scenario-sidebar{
  display:none!important;visibility:hidden!important;width:0!important;min-width:0!important;max-width:0!important;flex:0 0 0!important;overflow:hidden!important
}

/* Active mobile slides use normal flow instead of the desktop fixed stage. */
html.qmx-mobile-layout-v5 body .slide,
html.qmx-mobile-layout-v5 body .slide[data-qmx-template-stage="true"]{
  --qmx-stage-width:100%!important;--qmx-stage-height:auto!important;position:relative!important;inset:auto!important;
  left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;display:none!important;width:100%!important;max-width:100%!important;
  min-width:0!important;height:auto!important;min-height:100%!important;max-height:none!important;margin:0!important;padding:12px 10px 18px!important;
  overflow:visible!important;transform:none!important;scale:1!important;align-items:stretch!important;justify-content:flex-start!important
}
html.qmx-mobile-layout-v5 body .slide.active,
html.qmx-mobile-layout-v5 body .slide[data-qmx-template-stage="true"].active{
  display:block!important;position:relative!important;inset:auto!important;width:100%!important;height:auto!important;min-height:100%!important;
  overflow:visible!important;transform:none!important
}
html.qmx-mobile-layout-v5 body .slide>.qmx-cover-shell,
html.qmx-mobile-layout-v5 body .slide>.qmx-learning-shell,
html.qmx-mobile-layout-v5 body .slide>.qmx-quiz-shell,
html.qmx-mobile-layout-v5 body .slide>.qmx-final-shell,
html.qmx-mobile-layout-v5 body .slide[data-qmx-template-stage="true"]>.qmx-cover-shell,
html.qmx-mobile-layout-v5 body .slide[data-qmx-template-stage="true"]>.qmx-learning-shell,
html.qmx-mobile-layout-v5 body .slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,
html.qmx-mobile-layout-v5 body .slide[data-qmx-template-stage="true"]>.qmx-final-shell{
  position:relative!important;inset:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;
  min-height:0!important;max-height:none!important;margin:0!important;transform:none!important;scale:1!important;box-sizing:border-box!important
}
html.qmx-mobile-layout-v5 body .qmx-cover-shell,
html.qmx-mobile-layout-v5 body .qmx-learning-shell,
html.qmx-mobile-layout-v5 body .qmx-learning-shell.has-image,
html.qmx-mobile-layout-v5 body .qmx-learning-shell.no-image,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image{
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;grid-template-areas:none!important;gap:14px!important;
  align-items:start!important;align-content:start!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;
  min-height:0!important;max-height:none!important
}
html.qmx-mobile-layout-v5 body .qmx-cover-shell,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-cover-shell{padding:16px 14px!important;border-radius:16px!important}
html.qmx-mobile-layout-v5 body .qmx-copy,
html.qmx-mobile-layout-v5 body .qmx-cover-copy,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell .qmx-copy{
  display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;
  padding:0!important;margin:0!important;align-self:auto!important
}
html.qmx-mobile-layout-v5 body .qmx-copy h2,
html.qmx-mobile-layout-v5 body .qmx-cover-copy h2,
html.qmx-mobile-layout-v5 body .qmx-quiz-shell h2,
html.qmx-mobile-layout-v5 body .qmx-final-shell h2,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-copy h2{
  width:100%!important;max-width:100%!important;margin:0 0 10px!important;font-size:clamp(22px,7vw,32px)!important;line-height:1.12!important;
  letter-spacing:-.024em!important;overflow-wrap:anywhere!important;word-break:normal!important;text-wrap:balance!important
}
html.qmx-mobile-layout-v5 body .qmx-cover-copy h2{font-size:clamp(25px,8vw,35px)!important}
html.qmx-mobile-layout-v5 body .qmx-copy>p,
html.qmx-mobile-layout-v5 body .qmx-cover-copy>p,
html.qmx-mobile-layout-v5 body .qmx-quiz-shell>p,
html.qmx-mobile-layout-v5 body .qmx-final-shell>p{
  width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;font-size:14px!important;line-height:1.5!important;overflow-wrap:anywhere!important
}
html.qmx-mobile-layout-v5 body .eyebrow{font-size:9px!important;line-height:1.25!important;margin-bottom:8px!important}
html.qmx-mobile-layout-v5 body .qmx-meta{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin-top:16px!important}
html.qmx-mobile-layout-v5 body .qmx-meta span{font-size:9px!important;padding:6px 8px!important}

html.qmx-mobile-layout-v5 body .qmx-native-media,
html.qmx-mobile-layout-v5 body .qmx-learning-shell.has-image .qmx-native-media,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-native-media{
  display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;inset:auto!important;order:2!important;width:100%!important;
  max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:16/9!important;margin:0!important;
  border-radius:14px!important;overflow:hidden!important;align-self:auto!important
}
html.qmx-mobile-layout-v5 body .qmx-native-media img{
  display:block!important;width:100%!important;max-width:100%!important;height:100%!important;min-height:0!important;object-fit:cover!important
}

html.qmx-mobile-layout-v5 body .qmx-cards,
html.qmx-mobile-layout-v5 body .qmx-cards.qmx-flip-grid,
html.qmx-mobile-layout-v5 body .qmx-static-cards,
html.qmx-mobile-layout-v5 body .qmx-process,
html.qmx-mobile-layout-v5 body .qmx-compare,
html.qmx-mobile-layout-v5 body .qmx-options,
html.qmx-mobile-layout-v5 body .qmx-explore-grid,
html.qmx-mobile-layout-v5 body .qmx-interaction-grid,
html.qmx-mobile-layout-v5 body .qmx-step-grid-v2,
html.qmx-mobile-layout-v5 body .qmx-explore-grid-v2,
html.qmx-mobile-layout-v5 body .qmx-compare-grid-v2,
html.qmx-mobile-layout-v5 body .qmx-decision-grid-v2,
html.qmx-mobile-layout-v5 body .qmx-scenario-options,
html.qmx-mobile-layout-v5 body .qmx-branch-options{
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;grid-auto-columns:minmax(0,1fr)!important;
  grid-auto-rows:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;
  max-height:none!important;gap:10px!important;margin-top:14px!important;align-items:stretch!important;justify-content:stretch!important
}

/* Interaction runtimes replace the source cards/process with a new mobile grid. Keep the replaced source out of layout. */
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-interaction-source,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-process.qmx-interaction-source,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-cards.qmx-interaction-source,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-static-cards.qmx-interaction-source,
html.qmx-mobile-layout-v5 body[data-qmx-course-template="highly-interactive"] .qmx-compare.qmx-interaction-source{
  display:none!important;visibility:hidden!important;position:absolute!important;
  width:0!important;max-width:0!important;height:0!important;min-height:0!important;max-height:0!important;
  margin:0!important;padding:0!important;gap:0!important;overflow:hidden!important;pointer-events:none!important
}

html.qmx-mobile-layout-v5 body .qmx-card,
html.qmx-mobile-layout-v5 body .qmx-step,
html.qmx-mobile-layout-v5 body .qmx-compare-col,
html.qmx-mobile-layout-v5 body .qmx-static-card,
html.qmx-mobile-layout-v5 body .qmx-explore-option,
html.qmx-mobile-layout-v5 body .qmx-option,
html.qmx-mobile-layout-v5 body .qmx-interaction-panel,
html.qmx-mobile-layout-v5 body .quiz-option{
  width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;box-sizing:border-box!important
}
html.qmx-mobile-layout-v5 body .quiz-option{min-height:54px!important;padding:12px 13px!important;font-size:13px!important;line-height:1.35!important}
html.qmx-mobile-layout-v5 body .qmx-flip-card,
html.qmx-mobile-layout-v5 body .qmx-flip-inner,
html.qmx-mobile-layout-v5 body .qmx-flip-face,
html.qmx-mobile-layout-v5 body .qmx-reveal-card,
html.qmx-mobile-layout-v5 body .qmx-reveal-card-inner,
html.qmx-mobile-layout-v5 body .qmx-reveal-face{
  width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;max-height:none!important;min-height:126px!important;box-sizing:border-box!important
}
html.qmx-mobile-layout-v5 body .qmx-quiz-shell,
html.qmx-mobile-layout-v5 body .qmx-final-shell{
  width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;
  padding:18px 14px!important;border-radius:16px!important;text-align:left!important
}
html.qmx-mobile-layout-v5 body .qmx-final-shell{text-align:center!important}
html.qmx-mobile-layout-v5 body .qmx-template-layer{
  position:fixed!important;inset:8px!important;padding:8px!important;overflow:auto!important;align-items:flex-start!important
}
html.qmx-mobile-layout-v5 body .qmx-template-layer-card{
  width:100%!important;max-width:100%!important;max-height:none!important;padding:18px 14px!important;border-radius:16px!important
}
html.qmx-mobile-layout-v5 body .qmx-template-layer-list{grid-template-columns:minmax(0,1fr)!important}
html.qmx-mobile-layout-v5 body footer{
  width:100%!important;max-width:100%!important;height:auto!important;min-height:58px!important;max-height:none!important;padding:7px 8px!important;
  display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;gap:6px!important;align-items:center!important;flex:0 0 auto!important;overflow:hidden!important
}
html.qmx-mobile-layout-v5 body footer .nav-btn{
  width:100%!important;max-width:100%!important;min-width:0!important;min-height:42px!important;height:auto!important;padding:8px 9px!important;font-size:11px!important;line-height:1.2!important
}
html.qmx-mobile-layout-v5 body footer .part,html.qmx-mobile-layout-v5 body footer #slide-number{font-size:8.5px!important;line-height:1.2!important;white-space:nowrap!important}
html.qmx-mobile-layout-v5.qmx-mobile-narrow-v5 body .slide,
html.qmx-mobile-layout-v5.qmx-mobile-narrow-v5 body .slide[data-qmx-template-stage="true"]{padding:9px 8px 14px!important}
html.qmx-mobile-layout-v5.qmx-mobile-narrow-v5 body .qmx-cover-shell{padding:13px 11px!important}
html.qmx-mobile-layout-v5.qmx-mobile-narrow-v5 body header h1{display:none!important}
html.qmx-mobile-layout-v5.qmx-mobile-narrow-v5 body .qmx-copy h2,
html.qmx-mobile-layout-v5.qmx-mobile-narrow-v5 body .qmx-quiz-shell h2,
html.qmx-mobile-layout-v5.qmx-mobile-narrow-v5 body .qmx-final-shell h2{font-size:clamp(21px,7.2vw,29px)!important}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  if(window.__quizmotoMobileResponsiveV5)return;
  window.__quizmotoMobileResponsiveV5=true;
  var root=document.documentElement;
  var queued=false;
  function positive(v){v=Number(v);return Number.isFinite(v)&&v>0?v:null;}
  function viewportWidth(){
    var values=[positive(window.innerWidth),positive(document.documentElement&&document.documentElement.clientWidth),positive(window.visualViewport&&window.visualViewport.width),positive(window.screen&&window.screen.width)].filter(Boolean);
    return values.length?Math.min.apply(Math,values):1024;
  }
  function setCssWidth(w){if(root&&root.style)root.style.setProperty('--qmx-mobile-vw',Math.max(280,Math.ceil(w))+'px');}
  function moveStyleLast(){var node=document.getElementById('${STYLE_ID}');if(node&&document.head&&node.parentNode===document.head&&document.head.lastElementChild!==node)document.head.appendChild(node);}
  function apply(){
    var w=viewportWidth();
    var mobile=w<=1024;
    if(root){root.classList.toggle('qmx-mobile-layout-v5',mobile);root.classList.toggle('qmx-mobile-narrow-v5',mobile&&w<=480);}
    if(document.body){
      document.body.classList.toggle('qmx-mobile-layout-v5',mobile);
      if(mobile)document.body.setAttribute('data-qmx-mobile-responsive','v5');else document.body.removeAttribute('data-qmx-mobile-responsive');
    }
    if(mobile)setCssWidth(w);else if(root&&root.style)root.style.removeProperty('--qmx-mobile-vw');
    moveStyleLast();
  }
  function schedule(){if(queued)return;queued=true;(window.requestAnimationFrame||function(fn){return setTimeout(fn,16);})(function(){queued=false;apply();});}
  function ready(){apply();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('load',function(){apply();setTimeout(apply,80);setTimeout(apply,320);setTimeout(apply,900);},{once:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(apply,50);setTimeout(apply,250);},{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',schedule,{passive:true});
  if(document.head&&window.MutationObserver)new MutationObserver(schedule).observe(document.head,{childList:true});
  if(document.body&&window.MutationObserver)new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-qmx-template-stage','data-qmx-interaction','data-qmx-course-template']});
  [0,40,120,260,600,1200,2000].forEach(function(ms){setTimeout(apply,ms);});
})();
</script>`;
}

function stripRuntime(html, tag, id) {
    const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<${tag}\\b[^>]*\\bid=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/${tag}>\\s*`, 'gi');
    return String(html || '').replace(pattern, '');
}

function inject(html) {
    let next = String(html || '');
    if (!next) return next;
    [STYLE_ID, ...LEGACY_STYLE_IDS].forEach((id) => { next = stripRuntime(next, 'style', id); });
    [SCRIPT_ID, ...LEGACY_SCRIPT_IDS].forEach((id) => { next = stripRuntime(next, 'script', id); });
    const styleBlock = style();
    const scriptBlock = script();
    next = next.includes('</head>') ? next.replace('</head>', `${styleBlock}\n</head>`) : `${styleBlock}\n${next}`;
    next = next.includes('</body>') ? next.replace('</body>', `${scriptBlock}\n</body>`) : `${next}\n${scriptBlock}`;
    return next;
}

async function applyMobileHardeningRuntimeToZip(zipBuffer) {
    const zip = await JSZip.loadAsync(zipBuffer);
    const entry = zip.file('index.html');
    if (!entry) return zipBuffer;
    const html = await entry.async('string');
    zip.file('index.html', inject(html));
    return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:3}});
}

module.exports = {STYLE_ID,SCRIPT_ID,style,script,inject,applyMobileHardeningRuntimeToZip};
