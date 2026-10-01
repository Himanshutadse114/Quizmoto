'use strict';

const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 720;

function escapePattern(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripRuntime(html, tag, id) {
    const escaped = escapePattern(id);
    const pattern = new RegExp(`<${tag}\\b[^>]*\\bid=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/${tag}>\\s*`, 'gi');
    return String(html || '').replace(pattern, '');
}

function neutralizeResponsiveMediaQueries(html, excludedIds = []) {
    const excluded = new Set((excludedIds || []).map(String));
    return String(html || '').replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (block, attrs, css) => {
        const idMatch = String(attrs || '').match(/\bid=["']([^"']+)["']/i);
        if (idMatch && excluded.has(idMatch[1])) return block;
        const fixed = String(css).replace(/@media\s*([^\{]*(?:max-width|max-height)\s*:[^\{]*)\{/gi, '@media (min-width: 99999px){');
        return `<style${attrs}>${fixed}</style>`;
    });
}

function scaledDesktopStyle(styleId, version) {
    return `<style id="${styleId}">
/* ${version}: preserve the authored 16:9 desktop composition and scale it as one canvas. */
html.qmx-scaled-desktop,
html.qmx-scaled-desktop body{
  width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;
  margin:0!important;padding:0!important;overflow:hidden!important;overscroll-behavior:none!important;
  background:#071310!important
}
html.qmx-scaled-desktop body #app{
  position:fixed!important;z-index:1!important;
  left:var(--qmx-desktop-left,0px)!important;top:var(--qmx-desktop-top,0px)!important;
  width:${DESKTOP_WIDTH}px!important;min-width:${DESKTOP_WIDTH}px!important;max-width:${DESKTOP_WIDTH}px!important;
  height:${DESKTOP_HEIGHT}px!important;min-height:${DESKTOP_HEIGHT}px!important;max-height:${DESKTOP_HEIGHT}px!important;
  margin:0!important;overflow:hidden!important;
  transform:scale(var(--qmx-desktop-scale,1))!important;transform-origin:top left!important;
  -webkit-transform:scale(var(--qmx-desktop-scale,1))!important;-webkit-transform-origin:top left!important;
  contain:layout paint style
}
html.qmx-scaled-desktop body #app>header,
html.qmx-scaled-desktop body #app>footer{flex-shrink:0!important}
html.qmx-scaled-desktop body #app>main,
html.qmx-scaled-desktop body #app>#content-area,
html.qmx-scaled-desktop body #app>.qmx-course-body,
html.qmx-scaled-desktop body #app>.qmx-scenario-body{min-width:0!important;min-height:0!important}
html.qmx-scaled-desktop body .qmx-course-sidebar,
html.qmx-scaled-desktop body .qmx-scenario-sidebar{display:flex!important;visibility:visible!important}
html.qmx-scaled-desktop body .slide.qmx-mobile-visible-v7{display:none!important}
html.qmx-scaled-desktop body .slide.qmx-mobile-visible-v7.active{display:flex!important}
@media(prefers-reduced-motion:reduce){html.qmx-scaled-desktop body #app{transition:none!important}}
</style>`;
}

function scaledDesktopScript(scriptId, styleId, version) {
    return `<script id="${scriptId}">
(function(){
  if(window.__quizmotoScaledDesktopRuntime)return;
  window.__quizmotoScaledDesktopRuntime='${version}';
  var WIDTH=${DESKTOP_WIDTH},HEIGHT=${DESKTOP_HEIGHT},root=document.documentElement,queued=false;
  function number(value){value=Number(value);return Number.isFinite(value)&&value>0?value:null;}
  function minimum(values,fallback){values=values.filter(Boolean);return values.length?Math.min.apply(Math,values):fallback;}
  function viewport(){
    var visual=window.visualViewport;
    return {
      width:minimum([number(visual&&visual.width),number(window.innerWidth),number(root&&root.clientWidth)],WIDTH),
      height:minimum([number(visual&&visual.height),number(window.innerHeight),number(root&&root.clientHeight)],HEIGHT),
      left:number(visual&&visual.offsetLeft)||0,
      top:number(visual&&visual.offsetTop)||0
    };
  }
  function removeLegacyClasses(){
    root.classList.remove('qmx-mobile-layout-v7','qmx-mobile-narrow-v7');
    if(document.body){document.body.classList.remove('qmx-mobile-layout-v7','qmx-mobile-narrow-v7');document.body.removeAttribute('data-qmx-mobile-responsive');}
    Array.prototype.forEach.call(document.querySelectorAll('.qmx-mobile-visible-v7'),function(node){node.classList.remove('qmx-mobile-visible-v7');});
  }
  function keepStyleLast(){var style=document.getElementById('${styleId}');if(style&&style.parentNode===document.head&&document.head.lastElementChild!==style)document.head.appendChild(style);}
  function apply(){
    var app=document.getElementById('app'),view=viewport();
    if(!app)return;
    var scaled=view.width<WIDTH||view.height<HEIGHT;
    root.classList.toggle('qmx-scaled-desktop',scaled);
    if(document.body){document.body.classList.toggle('qmx-scaled-desktop',scaled);document.body.setAttribute('data-qmx-mobile-presentation',scaled?'scaled-desktop':'native-desktop');}
    removeLegacyClasses();
    if(scaled){
      var scale=Math.max(.1,Math.min(1,view.width/WIDTH,view.height/HEIGHT));
      var left=view.left+Math.max(0,(view.width-(WIDTH*scale))/2);
      var top=view.top+Math.max(0,(view.height-(HEIGHT*scale))/2);
      root.style.setProperty('--qmx-desktop-scale',scale.toFixed(6));
      root.style.setProperty('--qmx-desktop-left',left.toFixed(2)+'px');
      root.style.setProperty('--qmx-desktop-top',top.toFixed(2)+'px');
      app.setAttribute('data-qmx-scaled-desktop','true');
    }else{
      root.style.removeProperty('--qmx-desktop-scale');root.style.removeProperty('--qmx-desktop-left');root.style.removeProperty('--qmx-desktop-top');
      app.removeAttribute('data-qmx-scaled-desktop');
    }
    keepStyleLast();
    try{window.dispatchEvent(new CustomEvent('quizmoto:desktop-scale',{detail:{scaled:scaled,width:view.width,height:view.height}}));}catch(e){}
  }
  function schedule(){if(queued)return;queued=true;(window.requestAnimationFrame||function(fn){return setTimeout(fn,16);})(function(){queued=false;apply();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('load',function(){apply();setTimeout(apply,80);setTimeout(apply,320);},{once:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',function(){setTimeout(apply,60);setTimeout(apply,280);},{passive:true});
  if(window.visualViewport){window.visualViewport.addEventListener('resize',schedule,{passive:true});window.visualViewport.addEventListener('scroll',schedule,{passive:true});}
  if(document.head&&window.MutationObserver)new MutationObserver(function(){keepStyleLast();}).observe(document.head,{childList:true});
  [0,50,160,420,900].forEach(function(ms){setTimeout(apply,ms);});
})();
</script>`;
}

function injectScaledDesktopRuntime(html, options = {}) {
    const styleId = String(options.styleId || 'quizmoto-scaled-desktop-style');
    const scriptId = String(options.scriptId || 'quizmoto-scaled-desktop-script');
    const version = String(options.version || 'scaled-desktop-v1');
    const removeStyleIds = Array.from(new Set([styleId, ...(options.removeStyleIds || [])]));
    const removeScriptIds = Array.from(new Set([scriptId, ...(options.removeScriptIds || [])]));
    let next = String(html || '');
    if (!next) return next;
    removeStyleIds.forEach((id) => { next = stripRuntime(next, 'style', id); });
    removeScriptIds.forEach((id) => { next = stripRuntime(next, 'script', id); });
    next = neutralizeResponsiveMediaQueries(next, removeStyleIds);
    const styleBlock = scaledDesktopStyle(styleId, version);
    const scriptBlock = scaledDesktopScript(scriptId, styleId, version);
    next = next.includes('</head>') ? next.replace('</head>', `${styleBlock}\n</head>`) : `${styleBlock}\n${next}`;
    next = next.includes('</body>') ? next.replace('</body>', `${scriptBlock}\n</body>`) : `${next}\n${scriptBlock}`;
    return next;
}

module.exports = {
    DESKTOP_WIDTH,
    DESKTOP_HEIGHT,
    stripRuntime,
    neutralizeResponsiveMediaQueries,
    scaledDesktopStyle,
    scaledDesktopScript,
    injectScaledDesktopRuntime
};
