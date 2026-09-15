'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'quizmoto-mobile-course-hardening-v4';
const SCRIPT_ID = 'quizmoto-mobile-course-hardening-script-v4';

function style() {
    return `<style id="${STYLE_ID}">
@media (max-width: 900px) {
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] main,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-course-body,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-course-main,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-scenario-body,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-scenario-main{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important}

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .slide[data-qmx-template-stage="true"],
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-template-stage="true"].active{
    --qmx-stage-width:100%!important;--qmx-stage-height:auto!important;position:absolute!important;inset:0!important;
    width:100%!important;max-width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
    padding:12px 10px 16px!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;
    overscroll-behavior:contain!important;align-items:flex-start!important;justify-content:flex-start!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .slide[data-qmx-template-stage="true"]>.qmx-cover-shell,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .slide[data-qmx-template-stage="true"]>.qmx-learning-shell,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .slide[data-qmx-template-stage="true"]>.qmx-final-shell{
    width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;
    margin:0 auto!important;transform:none!important;scale:1!important;box-sizing:border-box!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-cover-shell,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-learning-shell,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-learning-shell.has-image,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-learning-shell.no-image,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-interaction] .qmx-learning-shell,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-interaction] .qmx-learning-shell.has-image{
    display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;grid-template-areas:none!important;
    gap:14px!important;align-items:start!important;align-content:start!important;width:100%!important;max-width:100%!important;
    min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important
  }

  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .qmx-cover-shell{grid-template-columns:minmax(0,1fr)!important;gap:14px!important;padding:16px 14px!important}

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-copy,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-cover-copy,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .qmx-learning-shell.no-image .qmx-copy,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .qmx-learning-shell.has-image .qmx-copy{
    display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;
    max-height:none!important;padding:0!important;margin:0!important;align-self:auto!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-copy h2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-cover-copy h2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-quiz-shell h2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-final-shell h2,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .qmx-copy h2{
    max-width:100%!important;margin:0 0 10px!important;font-size:clamp(22px,7.2vw,32px)!important;line-height:1.1!important;
    letter-spacing:-.025em!important;overflow-wrap:anywhere!important;text-wrap:balance!important
  }
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-cover-copy h2{font-size:clamp(25px,8.2vw,35px)!important}
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-copy>p,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-quiz-shell>p,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-final-shell>p{
    width:100%!important;max-width:100%!important;font-size:13.5px!important;line-height:1.48!important;overflow-wrap:anywhere!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-native-media,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-learning-shell.has-image .qmx-native-media,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .qmx-cover-shell .qmx-native-media,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-interaction] .qmx-native-media{
    display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;order:2!important;
    width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;
    aspect-ratio:16/9!important;margin:0!important;border-radius:14px!important;align-self:auto!important;overflow:hidden!important
  }
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-native-media img{display:block!important;width:100%!important;max-width:100%!important;height:100%!important;object-fit:cover!important}

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-cards,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-cards.qmx-flip-grid,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-static-cards,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-process,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-compare,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-explore-grid,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-options,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-interaction-grid,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-step-grid-v2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-explore-grid-v2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-compare-grid-v2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-decision-grid-v2,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-interaction] .qmx-cards,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-interaction] .qmx-cards.qmx-flip-grid,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-interaction] .qmx-process,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .slide[data-qmx-interaction] .qmx-interaction-grid,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .qmx-learning-shell.no-image .qmx-cards.qmx-flip-grid{
    width:100%!important;max-width:100%!important;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;
    grid-template-rows:auto!important;grid-auto-rows:auto!important;gap:10px!important;height:auto!important;min-height:0!important;max-height:none!important;
    margin-top:14px!important;align-items:stretch!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-card,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-step,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-compare-col,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-static-card,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-explore-option,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-option,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-interaction-panel{
    width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;box-sizing:border-box!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-flip-card,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-flip-inner,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-flip-face,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-reveal-card,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-reveal-card-inner,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-reveal-face{
    width:100%!important;max-width:100%!important;min-width:0!important;min-height:136px!important;box-sizing:border-box!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-quiz-shell,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-final-shell{
    width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;
    padding:18px 14px!important;border-radius:16px!important;justify-content:flex-start!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-course-sidebar,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-scenario-sidebar{
    display:none!important;visibility:hidden!important;width:0!important;min-width:0!important;max-width:0!important;flex:0 0 0!important;overflow:hidden!important
  }

  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] footer,
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] footer{
    width:100%!important;height:auto!important;min-height:56px!important;max-height:none!important;padding:7px 8px!important;
    display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;gap:6px!important;align-items:center!important
  }
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] footer .nav-btn{width:100%!important;min-width:0!important;min-height:42px!important;height:auto!important;padding:8px 9px!important;font-size:11px!important}
}

@media (max-width: 480px) {
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .slide[data-qmx-template-stage="true"]{padding:10px 8px 13px!important}
  html body[data-qmx-course-template="highly-interactive"][data-qmx-mobile-hardening="v4"] .qmx-cover-shell{padding:13px 11px!important}
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-copy h2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-quiz-shell h2,
  html body[data-qmx-course-template][data-qmx-mobile-hardening="v4"] .qmx-final-shell h2{font-size:clamp(21px,7.4vw,29px)!important}
}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  if(window.__quizmotoMobileHardeningV4)return;
  window.__quizmotoMobileHardeningV4=true;
  var queued=false;
  function mobile(){return window.matchMedia?window.matchMedia('(max-width:900px)').matches:window.innerWidth<=900;}
  function apply(){
    if(document.body)document.body.setAttribute('data-qmx-mobile-hardening','v4');
    var node=document.getElementById('${STYLE_ID}');
    if(node&&document.head&&node.parentNode===document.head&&document.head.lastElementChild!==node)document.head.appendChild(node);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;if(mobile())apply();});}
  function ready(){apply();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('load',function(){apply();setTimeout(apply,120);setTimeout(apply,700);},{once:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(apply,80);setTimeout(apply,320);},{passive:true});
  if(document.head&&window.MutationObserver)new MutationObserver(schedule).observe(document.head,{childList:true});
  if(document.body&&window.MutationObserver)new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-qmx-template-stage','data-qmx-interaction']});
  [0,60,180,420,900,1600].forEach(function(ms){setTimeout(function(){if(mobile())apply();},ms);});
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
    next = stripRuntime(next, 'style', STYLE_ID);
    next = stripRuntime(next, 'script', SCRIPT_ID);
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