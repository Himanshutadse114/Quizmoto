'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'quizmoto-mobile-course-runtime-v2';
const SCRIPT_ID = 'quizmoto-mobile-course-runtime-script-v2';

function responsiveStyle() {
    return `<style id="${STYLE_ID}">
/*
 * Universal Quizmoto learner responsive guard.
 * This is intentionally format-agnostic: it supports the classic visual builder,
 * raster courses and the qmx template runtimes without changing desktop layouts.
 */
@media (max-width: 900px) {
  html,body{width:100%!important;max-width:100%!important;height:100%!important;min-height:100%!important;margin:0!important;overflow:hidden!important;overscroll-behavior:none!important}
  body *{box-sizing:border-box}
  body img,body video,body canvas,body svg{max-width:100%!important}
  body img,body video{height:auto}
  body #app{width:100%!important;max-width:100%!important;height:var(--qmx-safe-vh,100dvh)!important;min-height:0!important;max-height:var(--qmx-safe-vh,100dvh)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}

  header{width:100%!important;max-width:100%!important;height:auto!important;min-height:54px!important;max-height:none!important;padding:8px 11px!important;gap:8px!important;display:flex!important;align-items:center!important;flex:0 0 auto!important;overflow:hidden!important}
  header .brand-mark{width:32px!important;height:32px!important;min-width:32px!important;border-radius:9px!important;font-size:11px!important}
  header .qmx-brand-logo,header>img{display:block!important;width:auto!important;max-width:84px!important;height:auto!important;max-height:30px!important;object-fit:contain!important;flex:0 0 auto!important}
  header h1{min-width:0!important;max-width:32vw!important;margin:0!important;font-size:11.5px!important;line-height:1.2!important;font-weight:600!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  header .progress-shell{height:5px!important;min-width:34px!important;max-width:none!important;flex:1 1 auto!important;margin-left:auto!important}
  header .progress-text{font-size:9.5px!important;line-height:1!important;flex:0 0 auto!important;white-space:nowrap!important}
  #qmx-narration-toggle{min-width:42px!important;max-width:94px!important;min-height:38px!important;padding:6px 8px!important;font-size:9.5px!important;overflow:hidden!important;text-overflow:ellipsis!important}

  main,#content-area{position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;flex:1 1 auto!important;overflow:hidden!important}
  main .slide,#content-area>.slide,
  body[data-qmx-course-template] main .slide,
  body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{
    position:absolute!important;inset:0!important;width:100%!important;max-width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
    padding:14px 12px 18px!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;
    align-items:flex-start!important;justify-content:flex-start!important;box-sizing:border-box!important
  }
  main .slide.active,#content-area>.slide.active,body[data-qmx-course-template] main .slide.active{display:flex!important;flex-direction:column!important}

  /* Shared stage/shell sizing across every generated course family. */
  .stage,.qmx-stage,
  .qmx-cover-shell,.qmx-learning-shell,.qmx-quiz-shell,.qmx-final-shell,
  .slide[data-qmx-template-stage="true"]>.qmx-cover-shell,
  .slide[data-qmx-template-stage="true"]>.qmx-learning-shell,
  .slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,
  .slide[data-qmx-template-stage="true"]>.qmx-final-shell{
    width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;margin:auto!important;transform:none!important;scale:1!important;box-sizing:border-box!important
  }

  /* Two-column visual layouts become a natural vertical reading order. */
  .hero,.hub-wrap,.spotlight,.compare,
  .qmx-cover-shell,.qmx-learning-shell,.qmx-learning-shell.has-image,.qmx-learning-shell.no-image,
  .qmx-scenario-grid,.qmx-branch-grid,.qmx-scenario-consequence-grid,.qmx-scenario-choice-grid,
  .qmx-raster-stage-v6{
    display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-areas:none!important;grid-template-rows:auto!important;gap:14px!important;align-items:start!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important
  }
  .hero,.spotlight{padding:18px 16px!important;border-radius:16px!important}
  .hero-art,.spot-visual{width:100%!important;min-height:210px!important;height:min(46vw,310px)!important;max-height:310px!important;border-radius:16px!important;order:2!important}
  .qmx-copy,.qmx-cover-copy,.qmx-learning-shell .qmx-copy{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;padding:0!important;align-self:auto!important}

  .title,.section-head .title,.qmx-copy h2,.qmx-quiz-shell h2,.qmx-final-shell h2,.qmx-cover-copy h2,.slide.qmx-cover-slide .title{
    max-width:100%!important;margin-top:0!important;margin-bottom:10px!important;font-size:clamp(23px,7.2vw,34px)!important;line-height:1.1!important;letter-spacing:-.025em!important;overflow-wrap:anywhere!important;text-wrap:balance!important
  }
  .qmx-cover-copy h2,.slide.qmx-cover-slide .title{font-size:clamp(26px,8vw,37px)!important}
  .lead,.qmx-copy>p,.qmx-final-shell>p,.qmx-quiz-shell>p{max-width:100%!important;font-size:14px!important;line-height:1.5!important;overflow-wrap:anywhere!important}
  .eyebrow,.qmx-kicker{font-size:9px!important;line-height:1.2!important;margin-bottom:8px!important}
  .kp-row,.qmx-meta{gap:6px!important;margin-top:13px!important}
  .chip,.qmx-meta span{font-size:9.5px!important;padding:6px 8px!important;white-space:normal!important}

  .qmx-native-media,.qmx-native-visual-frame,.qmx-raster-native-panel,.qmx-native-cover-raster,
  body[data-qmx-course-template] .qmx-native-media{
    order:2!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:16/9!important;margin:0!important;border-radius:14px!important;align-self:auto!important;overflow:hidden!important
  }
  .qmx-native-media img,.qmx-runtime-picture,.qmx-runtime-picture img,.qmx-native-course-picture,.qmx-native-course-picture img{display:block!important;width:100%!important;max-width:100%!important;height:100%!important;object-fit:cover!important}

  /* All list/card/process/assessment formats use one responsive column. */
  .cards-grid,.process,.timeline,.hub-list,.quiz-options,
  .qmx-cards,.qmx-static-cards,.qmx-process,.qmx-compare,.qmx-explore-grid,.qmx-options,.quiz-options,.qmx-template-layer-list{
    width:100%!important;max-width:100%!important;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;grid-auto-rows:auto!important;gap:10px!important;height:auto!important
  }
  .timeline{padding-top:0!important}.timeline:before{display:none!important}
  .milestone{text-align:left!important;display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;gap:10px!important;align-items:start!important}
  .milestone .dot{width:30px!important;height:30px!important;margin:4px 0 0!important;border-width:5px!important;box-shadow:none!important}
  .milestone p{margin:0!important}
  .step:not(:last-child):after{display:none!important}

  .concept-card,.step,.milestone,.compare-col,.hub-item,.quiz-card,.final-card,
  .qmx-card,.qmx-step,.qmx-compare-col,.qmx-static-card,.qmx-explore-option,.quiz-option,.qmx-option,.qmx-flip-card,.qmx-flip-inner,.qmx-flip-face{
    width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important
  }
  .concept-card,.step,.compare-col,.hub-item{height:auto!important;min-height:0!important;padding:13px!important}
  .quiz-card,.final-card{height:auto!important;min-height:0!important;padding:18px 14px!important;border-radius:16px!important}
  .score-ring{width:132px!important;height:132px!important;margin:18px auto!important}.score-ring span{font-size:31px!important}
  .concept-card p,.step p,.milestone p,.compare-item,.hub-item,.qmx-card p,.qmx-step p,.qmx-compare-col p,.qmx-explore-label{font-size:12.5px!important;line-height:1.45!important;overflow-wrap:anywhere!important}
  .quiz-option,.qmx-option{min-height:48px!important;height:auto!important;padding:12px 13px!important;font-size:13px!important;line-height:1.35!important;text-align:left!important;white-space:normal!important;overflow-wrap:anywhere!important}
  .feedback{font-size:12px!important;line-height:1.45!important;padding:11px 12px!important}

  /* Template sidebars yield the full phone width to the active learning screen. */
  body[data-qmx-course-template] .qmx-course-sidebar,body[data-qmx-course-template] .qmx-scenario-sidebar{display:none!important;width:0!important;min-width:0!important;flex-basis:0!important}
  .qmx-course-body,.qmx-scenario-body{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;display:flex!important;overflow:hidden!important}
  .qmx-course-main,.qmx-scenario-main{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;flex:1 1 auto!important}
  .qmx-hotspot-panel,.qmx-scenario-panel,.qmx-branch-panel,.qmx-branch-consequence,.qmx-branch-consequence-body{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;max-height:none!important;overflow:visible!important;box-sizing:border-box!important}
  .qmx-branch-choice,.qmx-scenario-option{width:100%!important;min-height:48px!important;height:auto!important;padding:11px 12px!important;white-space:normal!important}
  .qmx-branch-continue{position:static!important;width:100%!important;min-height:46px!important;border-radius:9px!important;margin-top:10px!important}

  .qmx-template-layer{position:fixed!important;inset:6px!important;padding:6px!important;border-radius:14px!important;align-items:flex-start!important;overflow:hidden!important;z-index:999!important}
  .qmx-template-layer-card{width:100%!important;max-width:100%!important;max-height:calc(var(--qmx-safe-vh,100dvh) - 12px)!important;padding:18px 14px!important;border-radius:14px!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important}
  .qmx-template-layer-card h3{margin:0 42px 14px 0!important;font-size:21px!important;line-height:1.15!important}
  .qmx-template-layer-close{right:10px!important;top:10px!important;width:38px!important;height:38px!important}
  .qmx-template-layer-item{padding:11px 12px!important;font-size:12.5px!important}
  .qmx-focus-trigger{width:100%!important;min-height:46px!important;margin-top:14px!important;justify-content:center!important}

  footer{width:100%!important;max-width:100%!important;height:auto!important;min-height:58px!important;max-height:none!important;flex:0 0 auto!important;padding:7px 9px!important;gap:7px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:center!important;z-index:30!important;overflow:hidden!important}
  footer .nav-btn{width:100%!important;min-width:0!important;min-height:44px!important;height:auto!important;padding:9px 10px!important;border-radius:9px!important;font-size:12px!important;line-height:1!important;white-space:nowrap!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
  footer .part,#slide-number{max-width:68px!important;min-width:0!important;font-size:9px!important;line-height:1.2!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
}

@media (max-width: 480px) {
  header{min-height:50px!important;padding:6px 8px!important;gap:6px!important}
  header h1{max-width:26vw!important;font-size:10px!important}
  header .qmx-brand-logo,header>img{max-width:68px!important;max-height:25px!important}
  #qmx-narration-toggle{max-width:74px!important;font-size:0!important}
  #qmx-narration-toggle:after{content:'Audio';font-size:9px!important}
  main .slide,#content-area>.slide,body[data-qmx-course-template] main .slide,body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{padding:11px 9px 14px!important}
  .hero,.spotlight{padding:14px 12px!important}.hero-art,.spot-visual{min-height:180px!important}
  .title,.section-head .title,.qmx-copy h2,.qmx-quiz-shell h2,.qmx-final-shell h2{font-size:clamp(21px,7.5vw,29px)!important}
  .qmx-cover-copy h2,.slide.qmx-cover-slide .title{font-size:clamp(24px,8.5vw,33px)!important}
  .lead,.qmx-copy>p,.qmx-final-shell>p{font-size:13.2px!important;line-height:1.48!important}
  footer{min-height:54px!important;padding:6px 7px!important;gap:5px!important}
  footer .nav-btn{min-height:42px!important;font-size:11px!important;padding:8px!important}
  footer .part,#slide-number{max-width:54px!important;font-size:8.5px!important}
}

@media (max-width: 940px) and (max-height: 560px) and (orientation: landscape) {
  header{min-height:44px!important;padding:4px 8px!important}
  footer{min-height:48px!important;padding:4px 7px!important}
  footer .nav-btn{min-height:38px!important}
  main .slide,#content-area>.slide,body[data-qmx-course-template] main .slide,body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{padding:8px 10px 11px!important}
  .title,.section-head .title,.qmx-copy h2,.qmx-quiz-shell h2,.qmx-final-shell h2{font-size:22px!important}
  .hero,.spotlight{grid-template-columns:minmax(0,1fr) minmax(0,.8fr)!important;gap:12px!important;padding:12px!important}
  .hero-art,.spot-visual{order:initial!important;min-height:160px!important;height:100%!important;max-height:260px!important}
  .qmx-native-media,.qmx-native-visual-frame,.qmx-raster-native-panel{max-height:52vh!important;aspect-ratio:16/9!important}
}
</style>`;
}

function responsiveScript() {
    return `<script id="${SCRIPT_ID}">
(function(){
  if(window.__quizmotoMobileCourseRuntimeV2)return;
  window.__quizmotoMobileCourseRuntimeV2=true;

  function ensureViewport(){
    var meta=document.querySelector('meta[name="viewport"]');
    if(!meta){meta=document.createElement('meta');meta.name='viewport';document.head.appendChild(meta);}
    meta.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=5,viewport-fit=cover');
  }
  function syncHeight(){
    var viewport=window.visualViewport;
    var height=viewport&&viewport.height?viewport.height:window.innerHeight;
    if(height>0)document.documentElement.style.setProperty('--qmx-safe-vh',Math.round(height)+'px');
  }
  function keepResponsiveStyleLast(){
    var style=document.getElementById('${STYLE_ID}');
    if(style&&style.parentNode===document.head&&document.head.lastElementChild!==style){document.head.appendChild(style);}
  }
  function markReady(){
    if(document.body)document.body.setAttribute('data-qmx-mobile-runtime','v2');
    keepResponsiveStyleLast();
    syncHeight();
  }

  ensureViewport();
  syncHeight();
  keepResponsiveStyleLast();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',markReady,{once:true});else markReady();
  window.setTimeout(keepResponsiveStyleLast,0);
  window.setTimeout(keepResponsiveStyleLast,250);
  window.addEventListener('resize',syncHeight,{passive:true});
  window.addEventListener('orientationchange',function(){window.setTimeout(syncHeight,50);window.setTimeout(syncHeight,280);},{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',syncHeight,{passive:true});
})();
</script>`;
}

function injectMobileRuntime(html) {
    let source = String(html || '');
    if (!source) return source;
    if (!source.includes(STYLE_ID)) {
        const block = responsiveStyle();
        source = source.includes('</head>') ? source.replace('</head>', `${block}\n</head>`) : `${block}\n${source}`;
    }
    if (!source.includes(SCRIPT_ID)) {
        const block = responsiveScript();
        source = source.includes('</body>') ? source.replace('</body>', `${block}\n</body>`) : `${source}\n${block}`;
    }
    return source;
}

async function applyMobileResponsiveRuntimeToZip(zipBuffer) {
    const zip = await JSZip.loadAsync(zipBuffer);
    const entry = zip.file('index.html');
    if (!entry) return zipBuffer;
    const html = await entry.async('string');
    zip.file('index.html', injectMobileRuntime(html));
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    STYLE_ID,
    SCRIPT_ID,
    responsiveStyle,
    responsiveScript,
    injectMobileRuntime,
    applyMobileResponsiveRuntimeToZip
};