'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'quizmoto-mobile-course-responsive-v7';
const SCRIPT_ID = 'quizmoto-mobile-course-responsive-script-v7';
const LEGACY_STYLE_IDS = [
    'quizmoto-mobile-course-responsive-v6',
    'quizmoto-mobile-course-responsive-v5',
    'quizmoto-mobile-course-hardening-v4',
    'quizmoto-mobile-course-runtime-v3',
    'quizmoto-mobile-width-wrap-hotfix-v1'
];
const LEGACY_SCRIPT_IDS = [
    'quizmoto-mobile-course-responsive-script-v6',
    'quizmoto-mobile-course-responsive-script-v5',
    'quizmoto-mobile-course-hardening-script-v4',
    'quizmoto-mobile-course-runtime-script-v3'
];

function style() {
    return `<style id="${STYLE_ID}">
/* V7 preserves the LMS flex chrome and keeps the active slide in normal mobile flow. */
html.qmx-mobile-layout-v7,
html.qmx-mobile-layout-v7 body{
  width:100%!important;max-width:100%!important;min-width:0!important;height:100%!important;min-height:100%!important;
  margin:0!important;padding:0!important;overflow:hidden!important;box-sizing:border-box!important
}
html.qmx-mobile-layout-v7 body *{box-sizing:border-box!important;min-width:0}
html.qmx-mobile-layout-v7 body #app{
  width:100%!important;max-width:100%!important;height:100%!important;min-height:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important
}
html.qmx-mobile-layout-v7 body header{
  width:100%!important;max-width:100%!important;height:auto!important;min-height:52px!important;padding:7px 9px!important;gap:7px!important;
  display:flex!important;align-items:center!important;flex:0 0 auto!important;overflow:hidden!important
}
html.qmx-mobile-layout-v7 body header .brand-mark{width:30px!important;height:30px!important;min-width:30px!important;flex:0 0 30px!important}
html.qmx-mobile-layout-v7 body header .qmx-brand-logo,
html.qmx-mobile-layout-v7 body header>img{display:block!important;width:auto!important;max-width:78px!important;height:auto!important;max-height:29px!important;object-fit:contain!important;flex:0 0 auto!important}
html.qmx-mobile-layout-v7 body header img.qmx-duplicate-brand-logo{display:none!important}
html.qmx-mobile-layout-v7 body header h1{min-width:0!important;max-width:29vw!important;margin:0!important;font-size:10.5px!important;line-height:1.2!important;font-weight:600!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
html.qmx-mobile-layout-v7 body header .progress-shell{height:5px!important;min-width:24px!important;flex:1 1 auto!important;max-width:none!important;margin-left:auto!important}
html.qmx-mobile-layout-v7 body header .progress-text{font-size:9px!important;white-space:nowrap!important;flex:0 0 auto!important}
html.qmx-mobile-layout-v7 body #qmx-narration-toggle{min-width:34px!important;max-width:78px!important;min-height:34px!important;padding:5px 7px!important;font-size:9px!important}

html.qmx-mobile-layout-v7 body .qmx-course-body,
html.qmx-mobile-layout-v7 body .qmx-scenario-body{
  display:flex!important;flex-direction:column!important;flex:1 1 0!important;position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;
  height:auto!important;min-height:0!important;max-height:none!important;overflow:hidden!important
}
html.qmx-mobile-layout-v7 body .qmx-course-sidebar,
html.qmx-mobile-layout-v7 body .qmx-scenario-sidebar{display:none!important;visibility:hidden!important;width:0!important;min-width:0!important;max-width:0!important;flex:0 0 0!important;overflow:hidden!important}
html.qmx-mobile-layout-v7 body main,
html.qmx-mobile-layout-v7 body #content-area,
html.qmx-mobile-layout-v7 body .qmx-course-main,
html.qmx-mobile-layout-v7 body .qmx-scenario-main{
  display:block!important;position:relative!important;flex:1 1 0!important;width:100%!important;max-width:100%!important;min-width:0!important;
  height:auto!important;min-height:0!important;max-height:none!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important
}

/* The native player owns current-slide state. Current mobile slide stays in normal flow so content can never collapse out of view. */
html.qmx-mobile-layout-v7 body .slide,
html.qmx-mobile-layout-v7 body .slide[data-qmx-template-stage="true"]{--qmx-stage-width:100%!important;--qmx-stage-height:auto!important;width:100%!important;max-width:100%!important;min-width:0!important}
html.qmx-mobile-layout-v7 body .slide.active,
html.qmx-mobile-layout-v7 body .slide.is-active,
html.qmx-mobile-layout-v7 body .slide[data-active="true"],
html.qmx-mobile-layout-v7 body .slide[data-current="true"],
html.qmx-mobile-layout-v7 body .slide[aria-hidden="false"],
html.qmx-mobile-layout-v7 body .slide.qmx-mobile-visible-v7{
  display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;
  width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:100%!important;max-height:none!important;
  margin:0!important;padding:10px 9px 16px!important;overflow:visible!important;transform:none!important;scale:1!important
}

html.qmx-mobile-layout-v7 body .slide>.qmx-cover-shell,
html.qmx-mobile-layout-v7 body .slide>.qmx-learning-shell,
html.qmx-mobile-layout-v7 body .slide>.qmx-quiz-shell,
html.qmx-mobile-layout-v7 body .slide>.qmx-final-shell,
html.qmx-mobile-layout-v7 body .slide[data-qmx-template-stage="true"]>.qmx-cover-shell,
html.qmx-mobile-layout-v7 body .slide[data-qmx-template-stage="true"]>.qmx-learning-shell,
html.qmx-mobile-layout-v7 body .slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,
html.qmx-mobile-layout-v7 body .slide[data-qmx-template-stage="true"]>.qmx-final-shell{
  display:grid!important;visibility:visible!important;opacity:1!important;position:relative!important;inset:auto!important;transform:none!important;scale:1!important;
  grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;grid-template-areas:none!important;gap:13px!important;
  width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;align-items:start!important;align-content:start!important
}
/* Highly Interactive has interaction-specific desktop columns with greater
   selector weight than the generic mobile shell. Override them explicitly so
   image-led hotspot slides (such as Section 3) cannot retain a 430px column. */
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction]>.qmx-learning-shell.has-image{
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;gap:13px!important;
  width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;max-height:none!important;align-items:start!important
}
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction]>.qmx-learning-shell.has-image>.qmx-copy,
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction]>.qmx-learning-shell.has-image>.qmx-native-media{
  grid-column:1!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;transform:none!important
}
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction] .qmx-interaction-grid,
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction] .qmx-step-grid-v2,
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction] .qmx-explore-grid-v2,
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction] .qmx-compare-grid-v2,
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"][data-qmx-interaction] .qmx-decision-grid-v2{
  grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;width:100%!important;max-width:100%!important;min-width:0!important
}
html.qmx-mobile-layout-v7 body .qmx-cover-shell{padding:14px 12px!important;border-radius:15px!important}
html.qmx-mobile-layout-v7 body .qmx-copy,
html.qmx-mobile-layout-v7 body .qmx-cover-copy{display:block!important;visibility:visible!important;opacity:1!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;padding:0!important;margin:0!important;overflow:visible!important}
html.qmx-mobile-layout-v7 body .qmx-copy h1,
html.qmx-mobile-layout-v7 body .qmx-copy h2,
html.qmx-mobile-layout-v7 body .qmx-cover-copy h2,
html.qmx-mobile-layout-v7 body .qmx-quiz-shell h2,
html.qmx-mobile-layout-v7 body .qmx-final-shell h2{width:100%!important;max-width:100%!important;margin:0 0 9px!important;font-size:clamp(21px,7vw,31px)!important;line-height:1.12!important;letter-spacing:-.022em!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
html.qmx-mobile-layout-v7 body .qmx-cover-copy h2{font-size:clamp(24px,8vw,34px)!important}
html.qmx-mobile-layout-v7 body .qmx-copy p,
html.qmx-mobile-layout-v7 body .qmx-cover-copy p,
html.qmx-mobile-layout-v7 body .qmx-quiz-shell p,
html.qmx-mobile-layout-v7 body .qmx-final-shell p,
html.qmx-mobile-layout-v7 body .qmx-copy li{width:100%!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
html.qmx-mobile-layout-v7 body .qmx-copy>p,
html.qmx-mobile-layout-v7 body .qmx-cover-copy>p,
html.qmx-mobile-layout-v7 body .qmx-quiz-shell>p,
html.qmx-mobile-layout-v7 body .qmx-final-shell>p{font-size:14px!important;line-height:1.48!important;margin-left:0!important;margin-right:0!important}
html.qmx-mobile-layout-v7 body .eyebrow{font-size:9px!important;line-height:1.25!important;margin-bottom:7px!important}
html.qmx-mobile-layout-v7 body .qmx-meta{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin-top:14px!important}
html.qmx-mobile-layout-v7 body .qmx-meta span{font-size:9px!important;padding:6px 8px!important;white-space:normal!important}

html.qmx-mobile-layout-v7 body .qmx-native-media,
html.qmx-mobile-layout-v7 body .qmx-learning-shell.has-image .qmx-native-media,
html.qmx-mobile-layout-v7 body[data-qmx-course-template="highly-interactive"] .qmx-native-media{
  display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;inset:auto!important;order:2!important;
  width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:16/9!important;
  margin:0!important;border-radius:13px!important;overflow:hidden!important;align-self:auto!important
}
html.qmx-mobile-layout-v7 body .qmx-native-media img{display:block!important;width:100%!important;max-width:100%!important;height:100%!important;object-fit:cover!important}

html.qmx-mobile-layout-v7 body .qmx-cards,
html.qmx-mobile-layout-v7 body .qmx-cards.qmx-flip-grid,
html.qmx-mobile-layout-v7 body .qmx-static-cards,
html.qmx-mobile-layout-v7 body .qmx-process,
html.qmx-mobile-layout-v7 body .qmx-compare,
html.qmx-mobile-layout-v7 body .qmx-options,
html.qmx-mobile-layout-v7 body .quiz-options,
html.qmx-mobile-layout-v7 body .qmx-explore-grid,
html.qmx-mobile-layout-v7 body .qmx-interaction-grid,
html.qmx-mobile-layout-v7 body .qmx-step-grid-v2,
html.qmx-mobile-layout-v7 body .qmx-explore-grid-v2,
html.qmx-mobile-layout-v7 body .qmx-compare-grid-v2,
html.qmx-mobile-layout-v7 body .qmx-decision-grid-v2,
html.qmx-mobile-layout-v7 body .qmx-scenario-options,
html.qmx-mobile-layout-v7 body .qmx-branch-options{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;grid-auto-rows:auto!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;gap:9px!important;margin-top:13px!important;overflow:visible!important}

html.qmx-mobile-layout-v7 body .qmx-interaction-source,
html.qmx-mobile-layout-v7 body .qmx-process.qmx-interaction-source,
html.qmx-mobile-layout-v7 body .qmx-cards.qmx-interaction-source,
html.qmx-mobile-layout-v7 body .qmx-static-cards.qmx-interaction-source,
html.qmx-mobile-layout-v7 body .qmx-compare.qmx-interaction-source{display:none!important;visibility:hidden!important;position:absolute!important;width:0!important;max-width:0!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;gap:0!important;overflow:hidden!important;pointer-events:none!important}

html.qmx-mobile-layout-v7 body .qmx-card,
html.qmx-mobile-layout-v7 body .qmx-step,
html.qmx-mobile-layout-v7 body .qmx-compare-col,
html.qmx-mobile-layout-v7 body .qmx-static-card,
html.qmx-mobile-layout-v7 body .qmx-explore-option,
html.qmx-mobile-layout-v7 body .qmx-option,
html.qmx-mobile-layout-v7 body .qmx-interaction-panel,
html.qmx-mobile-layout-v7 body .quiz-option,
html.qmx-mobile-layout-v7 body .qmx-flip-card,
html.qmx-mobile-layout-v7 body .qmx-flip-inner,
html.qmx-mobile-layout-v7 body .qmx-flip-face,
html.qmx-mobile-layout-v7 body .qmx-reveal-card,
html.qmx-mobile-layout-v7 body .qmx-reveal-card-inner,
html.qmx-mobile-layout-v7 body .qmx-reveal-face{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;max-height:none!important;box-sizing:border-box!important}
html.qmx-mobile-layout-v7 body .qmx-card *,
html.qmx-mobile-layout-v7 body .qmx-step *,
html.qmx-mobile-layout-v7 body .qmx-compare-col *,
html.qmx-mobile-layout-v7 body .qmx-interaction-panel *,
html.qmx-mobile-layout-v7 body .qmx-option *,
html.qmx-mobile-layout-v7 body .quiz-option *{min-width:0!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
html.qmx-mobile-layout-v7 body .quiz-option{min-height:50px!important;padding:11px 12px!important;font-size:13px!important;line-height:1.35!important;text-align:left!important;white-space:normal!important}
html.qmx-mobile-layout-v7 body .qmx-quiz-shell,
html.qmx-mobile-layout-v7 body .qmx-final-shell{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;padding:16px 12px!important;border-radius:15px!important}

html.qmx-mobile-layout-v7 body footer{width:100%!important;max-width:100%!important;height:auto!important;min-height:56px!important;padding:7px 8px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;gap:6px!important;align-items:center!important;flex:0 0 auto!important;overflow:hidden!important}
html.qmx-mobile-layout-v7 body footer .nav-btn,
html.qmx-mobile-layout-v7 body footer .btn{width:100%!important;max-width:100%!important;min-width:0!important;min-height:40px!important;height:auto!important;padding:8px!important;font-size:11px!important;line-height:1.2!important}
html.qmx-mobile-layout-v7 body footer .part,
html.qmx-mobile-layout-v7 body footer #slide-number{font-size:8.5px!important;line-height:1.2!important;white-space:nowrap!important}
html.qmx-mobile-layout-v7.qmx-mobile-narrow-v7 body header h1{display:none!important}
html.qmx-mobile-layout-v7.qmx-mobile-narrow-v7 body .slide.active,
html.qmx-mobile-layout-v7.qmx-mobile-narrow-v7 body .slide.qmx-mobile-visible-v7{padding:8px 7px 13px!important}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  if(window.__quizmotoMobileResponsiveV7)return;
  window.__quizmotoMobileResponsiveV7=true;
  var root=document.documentElement,queued=false;
  function positive(v){v=Number(v);return Number.isFinite(v)&&v>0?v:null;}
  function viewportWidth(){var values=[positive(window.innerWidth),positive(document.documentElement&&document.documentElement.clientWidth),positive(window.visualViewport&&window.visualViewport.width),positive(window.screen&&window.screen.width)].filter(Boolean);return values.length?Math.min.apply(Math,values):1024;}
  function slides(){return Array.prototype.slice.call(document.querySelectorAll('.slide'));}
  function declared(n){return !!(n&&(n.classList.contains('active')||n.classList.contains('is-active')||n.getAttribute('data-active')==='true'||n.getAttribute('data-current')==='true'||n.getAttribute('aria-hidden')==='false'));}
  function visible(n){if(!n||n.hidden)return false;try{var s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';}catch(e){return false;}}
  function repair(mobile){var list=slides();if(!list.length)return;if(!mobile){list.forEach(function(n){n.classList.remove('qmx-mobile-visible-v7');});return;}var chosen=list.find(declared)||list.find(visible)||list.find(function(n){return n.getAttribute('data-kind')==='cover'||n.classList.contains('qmx-cover-slide');})||list[0];list.forEach(function(n){n.classList.toggle('qmx-mobile-visible-v7',n===chosen);});}
  function logos(){var header=document.querySelector('#app>header,header');if(!header)return;var imgs=Array.prototype.slice.call(header.querySelectorAll(':scope > img'));if(imgs.length<2)return;var keep=header.querySelector(':scope > img.qmx-brand-logo')||imgs[0];imgs.forEach(function(img){img.classList.toggle('qmx-duplicate-brand-logo',img!==keep);});}
  function moveLast(){var node=document.getElementById('${STYLE_ID}');if(node&&document.head&&node.parentNode===document.head&&document.head.lastElementChild!==node)document.head.appendChild(node);}
  function apply(){var w=viewportWidth(),mobile=w<=1024;root.classList.toggle('qmx-mobile-layout-v7',mobile);root.classList.toggle('qmx-mobile-narrow-v7',mobile&&w<=480);if(document.body){document.body.classList.toggle('qmx-mobile-layout-v7',mobile);if(mobile)document.body.setAttribute('data-qmx-mobile-responsive','v7');else document.body.removeAttribute('data-qmx-mobile-responsive');}logos();repair(mobile);moveLast();}
  function schedule(){if(queued)return;queued=true;(requestAnimationFrame||function(fn){setTimeout(fn,16)})(function(){queued=false;apply();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('load',function(){apply();setTimeout(apply,80);setTimeout(apply,300);setTimeout(apply,900);},{once:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(apply,60);setTimeout(apply,260);},{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',schedule,{passive:true});
  if(document.head&&window.MutationObserver)new MutationObserver(schedule).observe(document.head,{childList:true});
  if(document.body&&window.MutationObserver)new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-active','data-current','data-qmx-template-stage','data-qmx-course-template']});
  [0,50,140,320,700,1300,2200].forEach(function(ms){setTimeout(apply,ms);});
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
    return zip.generateAsync({ type:'nodebuffer', compression:'DEFLATE', compressionOptions:{ level:3 } });
}

module.exports = { STYLE_ID, SCRIPT_ID, style, script, inject, applyMobileHardeningRuntimeToZip };
