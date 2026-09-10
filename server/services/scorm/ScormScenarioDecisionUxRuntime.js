'use strict';

const JSZip = require('jszip');
const { applyCourseBrandingToZip } = require('./ScormCourseBrandingService');

const STYLE_ID = 'quizmoto-scenario-decision-ux-v3';
const SCRIPT_ID = 'quizmoto-scenario-decision-ux-script-v3';

const LEGACY_OBSERVER_BLOCK = "var main=document.querySelector('main');if(main){var observer=new MutationObserver(function(changes){var nav=changes.some(function(c){return c.type==='attributes'&&c.attributeName==='class'&&c.target&&c.target.classList&&c.target.classList.contains('slide');});if(nav){prepare();syncPath(false);}else syncNext();});observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-qmx-scenario-visited','data-qmx-scenario-focus-complete','data-qmx-scenario-decision-complete']});}";

function style() {
    return `<style id="${STYLE_ID}">
body[data-qmx-course-template="scenario-learning"] #next-btn[data-qmx-scenario-locked="true"]{visibility:visible!important;opacity:.42!important;pointer-events:none!important;cursor:not-allowed!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-grid{display:none!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-head{margin-top:9px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-copy>p{display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important;overflow:hidden!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-consequence:not([hidden]){display:block!important;margin-top:11px!important;max-height:min(330px,43vh)!important;overflow:auto!important;scrollbar-width:thin!important;scrollbar-color:rgba(17,109,99,.28) transparent!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-consequence-body{grid-template-columns:1fr 1fr!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-panel{padding:12px 14px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-panel p{font-size:11.8px!important;line-height:1.4!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-continue{position:sticky!important;bottom:0!important;margin:0!important;width:100%!important;min-height:44px!important;border-radius:0!important;z-index:2!important}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-objective{font-size:12px!important;line-height:1.42!important;font-weight:670!important;color:var(--ink,#10211f)!important}
@media(max-width:760px){body[data-qmx-course-template="scenario-learning"] .slide.qmx-branch-choice-made .qmx-branch-consequence-body{grid-template-columns:1fr!important}}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  if(window.__qmxScenarioDecisionUxV3)return;
  window.__qmxScenarioDecisionUxV3=true;
  function slideFor(node){return node&&node.closest?node.closest('main .slide'):null;}
  function sync(slide,scroll){
    if(!slide)return;
    var selected=slide.querySelector('.qmx-branch-choice.is-selected');
    slide.classList.toggle('qmx-branch-choice-made',Boolean(selected));
    if(!selected)return;
    var consequence=slide.querySelector('.qmx-branch-consequence:not([hidden])');
    if(scroll&&consequence&&consequence.scrollIntoView){
      setTimeout(function(){try{consequence.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){consequence.scrollIntoView(false);}},0);
    }
  }
  function syncAll(){Array.prototype.forEach.call(document.querySelectorAll('main .slide'),function(slide){sync(slide,false);});}
  document.addEventListener('click',function(event){
    var choice=event.target&&event.target.closest?event.target.closest('.qmx-branch-choice'):null;
    if(choice)setTimeout(function(){sync(slideFor(choice),true);},0);
    var cont=event.target&&event.target.closest?event.target.closest('.qmx-branch-continue'):null;
    if(cont)setTimeout(function(){var next=document.getElementById('next-btn');if(next&&!next.disabled)next.focus();},0);
  },true);
  document.addEventListener('qmx:scenario-update',function(event){sync(slideFor(event.target),false);},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncAll,{once:true});else syncAll();
  window.addEventListener('load',function(){setTimeout(syncAll,0);},{once:true});
})();
</script>`;
}

function removeLegacyObserver(html) {
    return String(html || '').replace(LEGACY_OBSERVER_BLOCK, "var main=document.querySelector('main');");
}

function inject(html) {
    let next = removeLegacyObserver(html);
    if (!next.includes(STYLE_ID)) {
        next = next.includes('</head>') ? next.replace('</head>', `${style()}\n</head>`) : `${style()}\n${next}`;
    }
    if (!next.includes(SCRIPT_ID)) {
        next = next.includes('</body>') ? next.replace('</body>', `${script()}\n</body>`) : `${next}\n${script()}`;
    }
    return next;
}

async function applyScenarioDecisionUxRuntimeToZip(zipBuffer, analysis = {}) {
    let result = zipBuffer;
    const templateId = String(analysis?.templateBinding?.templateId || '');
    if (templateId === 'scenario-learning' || analysis?.scenarioGraph) {
        const zip = await JSZip.loadAsync(result);
        const entry = zip.file('index.html');
        if (entry) {
            const html = await entry.async('string');
            zip.file('index.html', inject(html));
            result = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        }
    }

    if (analysis?.branding) {
        const branded = await applyCourseBrandingToZip(result, analysis.branding);
        result = branded.zipBuffer;
    }
    return result;
}

module.exports = {
    STYLE_ID,
    SCRIPT_ID,
    applyScenarioDecisionUxRuntimeToZip,
    inject,
    removeLegacyObserver,
    style,
    script
};
