'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'lmsgen-mobile-course-runtime-v1';
const SCRIPT_ID = 'lmsgen-mobile-course-runtime-script-v1';

function responsiveStyle() {
    return `<style id="${STYLE_ID}">
/* Final mobile layout guard. It is injected after template-specific runtimes so
   desktop stage sizing cannot force a phone to render a scaled desktop course. */
@media (max-width: 820px) {
  html,body{width:100%!important;height:100%!important;min-height:100%!important;max-width:100%!important;overflow:hidden!important;overscroll-behavior:none!important}
  html body #app{width:100%!important;height:var(--lmsgen-mobile-vh,100dvh)!important;min-height:0!important;max-height:var(--lmsgen-mobile-vh,100dvh)!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}

  header{width:100%!important;height:auto!important;min-height:52px!important;max-height:none!important;padding:8px 11px!important;gap:8px!important;flex:0 0 auto!important;display:flex!important;align-items:center!important;flex-wrap:nowrap!important;overflow:hidden!important}
  header .brand-mark{width:30px!important;height:30px!important;min-width:30px!important;border-radius:7px!important;font-size:11px!important}
  header .qmx-brand-logo{display:block!important;width:auto!important;max-width:82px!important;height:auto!important;max-height:28px!important;object-fit:contain!important;flex:0 0 auto!important}
  header h1{min-width:0!important;max-width:34vw!important;margin:0!important;font-size:11.5px!important;line-height:1.2!important;font-weight:600!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  header .progress-shell{height:4px!important;min-width:34px!important;max-width:none!important;flex:1 1 auto!important;margin-left:auto!important}
  header .progress-text{font-size:9.5px!important;line-height:1!important;flex:0 0 auto!important;white-space:nowrap!important}

  main,#content-area{position:relative!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;flex:1 1 auto!important;overflow:hidden!important}
  main .slide,
  body[data-qmx-course-template] main .slide,
  body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{
    position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;
    padding:14px 12px 18px!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;
    align-items:flex-start!important;justify-content:flex-start!important;box-sizing:border-box!important
  }
  main .slide.active,body[data-qmx-course-template] main .slide.active{display:flex!important;flex-direction:column!important}

  .slide[data-qmx-template-stage="true"]>.qmx-cover-shell,
  .slide[data-qmx-template-stage="true"]>.qmx-learning-shell,
  .slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,
  .slide[data-qmx-template-stage="true"]>.qmx-final-shell,
  .qmx-cover-shell,.qmx-learning-shell,.qmx-quiz-shell,.qmx-final-shell,
  body[data-qmx-course-template] .qmx-cover-shell,
  body[data-qmx-course-template] .qmx-learning-shell,
  body[data-qmx-course-template] .qmx-quiz-shell,
  body[data-qmx-course-template] .qmx-final-shell{
    width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;margin:auto!important;
    transform:none!important;scale:1!important;box-sizing:border-box!important
  }

  .qmx-cover-shell,
  .qmx-learning-shell,
  .qmx-learning-shell.has-image,
  .qmx-learning-shell.no-image,
  body[data-qmx-course-template] .qmx-cover-shell,
  body[data-qmx-course-template] .qmx-learning-shell,
  body[data-qmx-course-template] .qmx-learning-shell.has-image,
  body[data-qmx-course-template] .qmx-learning-shell.no-image{
    display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;gap:14px!important;align-items:start!important
  }
  .qmx-cover-shell{padding:18px 16px!important;border-radius:14px!important}
  .qmx-copy,.qmx-cover-copy,.qmx-learning-shell .qmx-copy{width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;padding:0!important;align-self:auto!important}

  .qmx-copy h2,.qmx-quiz-shell h2,.qmx-final-shell h2,
  body[data-qmx-course-template] .qmx-copy h2,
  .slide.qmx-cover-slide .title,.qmx-cover-copy h2{
    max-width:100%!important;margin:0 0 11px!important;font-size:clamp(24px,7.4vw,34px)!important;line-height:1.1!important;letter-spacing:-.025em!important;overflow-wrap:anywhere!important;text-wrap:balance!important
  }
  .qmx-cover-copy h2,.slide.qmx-cover-slide .title{font-size:clamp(27px,8.5vw,38px)!important}
  .qmx-copy>p,.qmx-final-shell>p,.qmx-quiz-shell>p,.lead,
  body[data-qmx-course-template] .qmx-copy>p{
    max-width:100%!important;font-size:14px!important;line-height:1.52!important;overflow-wrap:anywhere!important
  }
  .eyebrow,.qmx-kicker{font-size:9px!important;line-height:1.2!important;margin-bottom:8px!important}
  .qmx-meta{gap:6px!important;margin-top:16px!important}
  .qmx-meta span{font-size:9px!important;padding:6px 8px!important}

  .qmx-native-media,
  body[data-qmx-course-template] .qmx-native-media,
  body[data-qmx-course-template] .qmx-learning-shell.has-image .qmx-native-media,
  body[data-qmx-course-template] .qmx-cover-shell .qmx-native-media,
  body[data-qmx-course-template] .slide[data-qmx-interaction] .qmx-native-media{
    order:2!important;width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:16/9!important;margin:0!important;border-radius:14px!important;align-self:auto!important;overflow:hidden!important
  }
  .qmx-native-media img,.qmx-runtime-picture,.qmx-runtime-picture img{display:block!important;width:100%!important;max-width:100%!important;height:100%!important;object-fit:cover!important}

  .qmx-cards,.qmx-static-cards,.qmx-process,.qmx-compare,.qmx-explore-grid,
  .qmx-options,.quiz-options,.qmx-template-layer-list,
  body[data-qmx-course-template] .qmx-cards,
  body[data-qmx-course-template] .qmx-static-cards,
  body[data-qmx-course-template] .qmx-process,
  body[data-qmx-course-template] .qmx-compare,
  body[data-qmx-course-template] .qmx-explore-grid,
  body[data-qmx-course-template] .qmx-options{
    width:100%!important;max-width:100%!important;min-width:0!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto!important;grid-auto-rows:auto!important;gap:9px!important;margin-top:15px!important;height:auto!important
  }
  .qmx-card,.qmx-step,.qmx-compare-col,.qmx-static-card,.qmx-explore-option,
  .quiz-option,.qmx-option,.qmx-flip-card,.qmx-flip-inner,.qmx-flip-face{
    width:100%!important;max-width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;box-sizing:border-box!important
  }
  .qmx-card,.qmx-step,.qmx-compare-col{padding:12px!important}
  .qmx-card p,.qmx-step p,.qmx-compare-col p,.qmx-explore-label{font-size:12.5px!important;line-height:1.4!important}
  .quiz-option,.qmx-option{min-height:48px!important;padding:12px 13px!important;font-size:13px!important;line-height:1.35!important;text-align:left!important;white-space:normal!important;overflow-wrap:anywhere!important}
  .feedback{font-size:12px!important;line-height:1.45!important;padding:11px 12px!important}

  body[data-qmx-course-template] .qmx-course-sidebar,
  body[data-qmx-course-template] .qmx-scenario-sidebar{display:none!important;width:0!important;min-width:0!important;flex-basis:0!important}
  .qmx-course-body,.qmx-scenario-body{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;display:flex!important;overflow:hidden!important}
  .qmx-course-main,.qmx-scenario-main{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;flex:1 1 auto!important}

  .qmx-hotspot-panel,.qmx-scenario-panel,.qmx-branch-panel,.qmx-branch-consequence,.qmx-scenario-grid,.qmx-branch-grid,
  .qmx-branch-consequence-body,.qmx-scenario-consequence-grid,.qmx-scenario-choice-grid{
    width:100%!important;max-width:100%!important;min-width:0!important;grid-template-columns:minmax(0,1fr)!important;height:auto!important;max-height:none!important;overflow:visible!important;box-sizing:border-box!important
  }
  .qmx-hotspot-panel{padding:12px!important}.qmx-hotspot-panel p{font-size:12.5px!important;line-height:1.45!important}
  .qmx-branch-choice,.qmx-scenario-option{width:100%!important;min-height:52px!important;padding:11px 12px!important}
  .qmx-branch-consequence:not([hidden]){max-height:none!important;overflow:visible!important}
  .qmx-branch-continue{position:static!important;width:100%!important;min-height:46px!important;border-radius:9px!important;margin-top:10px!important}

  .qmx-template-layer{position:fixed!important;inset:6px!important;padding:6px!important;border-radius:14px!important;align-items:flex-start!important;overflow:hidden!important;z-index:999!important}
  .qmx-template-layer-card{width:100%!important;max-width:100%!important;max-height:calc(var(--lmsgen-mobile-vh,100dvh) - 12px)!important;padding:18px 14px!important;border-radius:14px!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important}
  .qmx-template-layer-card h3{margin:0 42px 14px 0!important;font-size:21px!important;line-height:1.15!important}
  .qmx-template-layer-close{right:10px!important;top:10px!important;width:34px!important;height:34px!important}
  .qmx-template-layer-item{padding:11px 12px!important;font-size:12.5px!important}
  .qmx-focus-trigger{width:100%!important;min-height:46px!important;margin-top:16px!important;justify-content:center!important}

  footer{width:100%!important;height:auto!important;min-height:58px!important;max-height:none!important;flex:0 0 auto!important;padding:8px 10px!important;gap:8px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:center!important;z-index:30!important;overflow:hidden!important}
  footer .nav-btn{width:100%!important;min-width:0!important;min-height:44px!important;padding:9px 11px!important;border-radius:9px!important;font-size:12px!important;line-height:1!important;white-space:nowrap!important}
  footer .part,#slide-number{max-width:72px!important;min-width:0!important;font-size:9px!important;line-height:1.2!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
}

@media (max-width: 420px) {
  header{min-height:48px!important;padding:7px 9px!important;gap:6px!important}
  header h1{max-width:29vw!important;font-size:10.5px!important}
  header .qmx-brand-logo{max-width:70px!important;max-height:25px!important}
  main .slide,body[data-qmx-course-template] main .slide,body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{padding:11px 9px 14px!important}
  .qmx-cover-shell{padding:15px 13px!important}
  .qmx-copy h2,.qmx-quiz-shell h2,.qmx-final-shell h2,body[data-qmx-course-template] .qmx-copy h2{font-size:clamp(22px,7.5vw,29px)!important}
  .qmx-cover-copy h2,.slide.qmx-cover-slide .title{font-size:clamp(25px,8.8vw,33px)!important}
  .qmx-copy>p,.qmx-final-shell>p,.lead,body[data-qmx-course-template] .qmx-copy>p{font-size:13.2px!important;line-height:1.48!important}
  footer{min-height:54px!important;padding:6px 8px!important;gap:6px!important}
  footer .nav-btn{min-height:42px!important;font-size:11px!important;padding:8px!important}
  footer .part,#slide-number{max-width:54px!important;font-size:8.5px!important}
}

@media (max-width: 920px) and (max-height: 540px) and (orientation: landscape) {
  header{min-height:44px!important;padding:5px 9px!important}
  footer{min-height:48px!important;padding:4px 8px!important}
  footer .nav-btn{min-height:38px!important}
  main .slide,body[data-qmx-course-template] main .slide,body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{padding:9px 12px 12px!important}
  .qmx-copy h2,.qmx-quiz-shell h2,.qmx-final-shell h2,body[data-qmx-course-template] .qmx-copy h2{font-size:23px!important}
  .qmx-cover-copy h2,.slide.qmx-cover-slide .title{font-size:27px!important}
  .qmx-native-media,body[data-qmx-course-template] .qmx-native-media{max-height:48vh!important;aspect-ratio:16/9!important}
}
</style>`;
}

function responsiveScript() {
    return `<script id="${SCRIPT_ID}">
(function(){
  if(window.__lmsgenMobileCourseRuntimeV1)return;
  window.__lmsgenMobileCourseRuntimeV1=true;
  function ensureViewport(){
    var meta=document.querySelector('meta[name="viewport"]');
    if(!meta){meta=document.createElement('meta');meta.name='viewport';document.head.appendChild(meta);}
    meta.setAttribute('content','width=device-width,initial-scale=1,viewport-fit=cover');
  }
  function syncHeight(){
    var viewport=window.visualViewport;
    var height=viewport&&viewport.height?viewport.height:window.innerHeight;
    if(height>0)document.documentElement.style.setProperty('--lmsgen-mobile-vh',Math.round(height)+'px');
  }
  ensureViewport();syncHeight();
  window.addEventListener('resize',syncHeight,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(syncHeight,60);setTimeout(syncHeight,300);},{passive:true});
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
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

module.exports = {
    STYLE_ID,
    SCRIPT_ID,
    responsiveStyle,
    responsiveScript,
    injectMobileRuntime,
    applyMobileResponsiveRuntimeToZip
};
