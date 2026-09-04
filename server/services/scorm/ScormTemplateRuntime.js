'use strict';

const STYLE_ID = 'quizmoto-template-stage-v1';
const SCRIPT_ID = 'quizmoto-template-stage-script-v1';

function safeAttr(value) {
    return String(value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 80);
}

function shouldUseTemplateRuntime(analysis) {
    return Number(analysis?.templateEngineVersion || 0) >= 1 && Boolean(analysis?.templateBinding?.templateId);
}

function runtimeStyle(templateId) {
    const id = safeAttr(templateId);
    return `<style id="${STYLE_ID}">
html.qmx-template-stage-root,html.qmx-template-stage-root body{height:100%!important;min-height:100%!important;overflow:hidden!important;overscroll-behavior:none!important}
body[data-qmx-course-template="${id}"] .slide[data-qmx-template-stage="true"]{overflow:hidden!important;overscroll-behavior:none!important;box-sizing:border-box!important}
.slide[data-qmx-template-stage="true"]>.layout,.slide[data-qmx-template-stage="true"]>.hero,.slide[data-qmx-template-stage="true"]>.stage,.slide[data-qmx-template-stage="true"]>.qmx-stage{transform-origin:center center;will-change:transform}
.slide[data-qmx-template-stage="true"].qmx-template-overflow:after{content:"";position:absolute;inset:0;pointer-events:none;border:1px solid transparent}
@media(max-width:760px){.slide[data-qmx-template-stage="true"]{padding:18px 18px!important}}
@media(prefers-reduced-motion:reduce){.slide[data-qmx-template-stage="true"] *{scroll-behavior:auto!important}}
</style>`;
}

function runtimeScript(templateId) {
    const id = safeAttr(templateId);
    return `<script id="${SCRIPT_ID}">
(function(){
  var TEMPLATE=${JSON.stringify(id)};
  var MIN_SCALE=.78;
  var fitting=false;
  function contentNode(slide){
    if(!slide)return null;
    return slide.querySelector(':scope > .layout,:scope > .hero,:scope > .stage,:scope > .qmx-stage')||slide.firstElementChild;
  }
  function availableSize(slide){
    var cs=window.getComputedStyle(slide);
    var px=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0);
    var py=parseFloat(cs.paddingTop||0)+parseFloat(cs.paddingBottom||0);
    return {w:Math.max(1,slide.clientWidth-px),h:Math.max(1,slide.clientHeight-py)};
  }
  function fit(slide){
    if(!slide||!slide.classList.contains('active'))return;
    var node=contentNode(slide);if(!node)return;
    node.style.transform='';
    node.style.setProperty('--qmx-template-fit','1');
    var available=availableSize(slide);
    var rect=node.getBoundingClientRect();
    var width=Math.max(node.scrollWidth||0,rect.width||0,1);
    var height=Math.max(node.scrollHeight||0,rect.height||0,1);
    var raw=Math.min(1,available.w/width,available.h/height);
    var scale=Math.max(MIN_SCALE,Math.min(1,raw));
    slide.classList.toggle('qmx-template-overflow',raw<MIN_SCALE);
    if(scale<.999){node.style.transform='scale('+scale.toFixed(4)+')';}
    slide.setAttribute('data-qmx-fit-scale',scale.toFixed(4));
  }
  function fitActive(){
    if(fitting)return;fitting=true;
    requestAnimationFrame(function(){
      fitting=false;
      var active=document.querySelector('.slide.active');
      fit(active);
    });
  }
  function install(){
    document.documentElement.classList.add('qmx-template-stage-root');
    document.body.setAttribute('data-qmx-course-template',TEMPLATE);
    Array.prototype.forEach.call(document.querySelectorAll('.slide'),function(slide){slide.setAttribute('data-qmx-template-stage','true')});
    fitActive();
    window.addEventListener('resize',fitActive,{passive:true});
    document.addEventListener('click',function(){setTimeout(fitActive,0);setTimeout(fitActive,180)},true);
    var observer=new MutationObserver(function(mutations){
      for(var i=0;i<mutations.length;i+=1){
        if(mutations[i].type==='attributes'||mutations[i].type==='childList'){fitActive();break;}
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-expanded','data-qmx-revealed']});
    [50,180,500,1000].forEach(function(ms){setTimeout(fitActive,ms)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function injectTemplateRuntime(html, analysis) {
    let source = String(html || '');
    if (!source || !shouldUseTemplateRuntime(analysis)) return source;
    const templateId = analysis.templateBinding.templateId;

    if (!source.includes(STYLE_ID)) {
        const style = runtimeStyle(templateId);
        source = source.includes('</head>') ? source.replace('</head>', `${style}\n</head>`) : `${style}\n${source}`;
    }
    if (!source.includes(SCRIPT_ID)) {
        const script = runtimeScript(templateId);
        source = source.includes('</body>') ? source.replace('</body>', `${script}\n</body>`) : `${source}\n${script}`;
    }
    return source;
}

module.exports = {
    STYLE_ID,
    SCRIPT_ID,
    injectTemplateRuntime,
    shouldUseTemplateRuntime
};
