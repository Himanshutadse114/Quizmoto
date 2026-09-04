'use strict';

const JSZip = require('jszip');
const { fitSlidePresentationContent } = require('./ScormTemplateContentFitter');

const STYLE_ID = 'quizmoto-template-stage-v2';
const SCRIPT_ID = 'quizmoto-template-stage-script-v2';

function safeAttr(value) {
    return String(value || '').replace(/[^a-z0-9_.-]/gi, '').slice(0, 120);
}

function safeJson(value) {
    return JSON.stringify(value == null ? null : value).replace(/</g, '\\u003c');
}

function shouldUseTemplateRuntime(analysis) {
    return Number(analysis?.templateEngineVersion || 0) >= 1 && Boolean(analysis?.templateBinding?.templateId);
}

function slideDescriptors(analysis) {
    const templateId = String(analysis?.templateBinding?.templateId || 'professional-classic');
    return (Array.isArray(analysis?.slides) ? analysis.slides : []).map((slide, index) => {
        const fitted = fitSlidePresentationContent(slide, templateId);
        return {
            section: index + 1,
            layout: safeAttr(slide?.layout || 'spotlight'),
            layoutId: safeAttr(slide?.layoutId || ''),
            interaction: safeAttr(slide?.interaction?.type || 'focus_reveal'),
            screenType: safeAttr(slide?.screenType || 'concept'),
            displayContent: String(fitted?.displayContent || '').trim()
        };
    });
}

function runtimeStyle(templateId) {
    const id = safeAttr(templateId);
    return `<style id="${STYLE_ID}">
html.qmx-template-stage-root,html.qmx-template-stage-root body{height:100%!important;min-height:100%!important;overflow:hidden!important;overscroll-behavior:none!important}
html.qmx-template-stage-root #app{height:100%!important;max-height:100%!important;overflow:hidden!important}
body[data-qmx-course-template="${id}"] main{overflow:hidden!important}
body[data-qmx-course-template="${id}"] .slide[data-qmx-template-stage="true"]{overflow:hidden!important;box-sizing:border-box!important}
.slide[data-qmx-template-stage="true"]>.qmx-cover-shell,.slide[data-qmx-template-stage="true"]>.qmx-learning-shell,.slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,.slide[data-qmx-template-stage="true"]>.qmx-final-shell{transform-origin:center center;will-change:transform}
.slide.qmx-stage-tight .qmx-copy h2{font-size:clamp(28px,3.2vw,44px)!important;margin-bottom:12px!important}
.slide.qmx-stage-tight .qmx-copy>p{font-size:14px!important;line-height:1.45!important}
.slide.qmx-stage-tight .qmx-cards,.slide.qmx-stage-tight .qmx-static-cards,.slide.qmx-stage-tight .qmx-process,.slide.qmx-stage-tight .qmx-compare{margin-top:14px!important;gap:8px!important}
.slide.qmx-stage-critical .qmx-copy h2{font-size:clamp(25px,2.8vw,38px)!important}
.slide.qmx-stage-critical .qmx-copy>p{font-size:13px!important;line-height:1.4!important}
.qmx-static-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}
.qmx-template-layer{position:absolute;inset:34px;z-index:45;display:none;align-items:center;justify-content:center;padding:18px;border-radius:24px;background:rgba(9,28,27,.38);backdrop-filter:blur(8px)}
.qmx-template-layer.is-open{display:flex}
.qmx-template-layer-card{position:relative;width:min(760px,92%);max-height:88%;overflow:hidden;border:1px solid var(--paper-3);border-radius:22px;background:var(--surface);box-shadow:0 24px 70px rgba(15,23,42,.2);padding:28px}
.qmx-template-layer-card h3{margin:0 48px 18px 0;font-size:26px;color:var(--ink)}
.qmx-template-layer-close{position:absolute;right:18px;top:18px;width:34px;height:34px;border:1px solid var(--paper-3);border-radius:50%;background:var(--paper);color:var(--ink);cursor:pointer}
.qmx-template-layer-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.qmx-template-layer-item{padding:14px 15px;border:1px solid var(--paper-3);border-radius:14px;background:var(--paper);font-size:14px;line-height:1.4;color:var(--ink-soft)}
.qmx-focus-trigger{margin-top:18px;min-height:42px;padding:10px 16px;border:1px solid var(--primary);border-radius:999px;background:var(--primary);color:#fff;font-weight:650;cursor:pointer}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell{width:min(1240px,100%)!important;gap:30px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-copy h2{font-size:clamp(34px,3.55vw,50px)!important;max-width:760px}
body[data-qmx-course-template="highly-interactive"] .qmx-copy>p{font-size:15px!important;line-height:1.52!important;max-width:720px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-cards,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-static-cards{display:none!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,1fr) minmax(360px,.86fr)!important;gap:42px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,1.28fr) minmax(290px,.72fr)!important;gap:28px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-native-media{max-height:300px;aspect-ratio:4/3;border-radius:22px}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-cards.qmx-flip-grid{max-width:720px!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin-top:16px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-flip-inner,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-flip-face{min-height:94px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-process{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;margin-top:18px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-step{min-height:108px;cursor:pointer;transition:.2s ease}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-step.is-selected{transform:translateY(-3px);border-color:var(--primary);background:var(--soft)}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-learning-shell.has-image{grid-template-columns:minmax(390px,1.05fr) minmax(0,.95fr)!important;gap:34px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-native-media{position:relative;overflow:hidden;border-radius:24px}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-hotspot-ready .qmx-cards,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-hotspot-ready .qmx-static-cards{display:none!important}
.qmx-hotspot-marker{position:absolute;width:38px;height:38px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;background:var(--primary);color:#fff;font-size:12px;font-weight:800;box-shadow:0 8px 22px rgba(0,0,0,.2);cursor:pointer;transform:translate(-50%,-50%)}
.qmx-hotspot-marker.is-selected{background:var(--ink);transform:translate(-50%,-50%) scale(1.08)}
.qmx-hotspot-panel{margin-top:18px;padding:16px 18px;border:1px solid var(--paper-3);border-radius:16px;background:var(--surface)}
.qmx-hotspot-panel-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--primary-dark);font-weight:800}
.qmx-hotspot-panel p{margin:7px 0 0!important;font-size:14px!important;line-height:1.45!important;color:var(--ink)!important;font-weight:600!important}
@media(max-width:980px){body[data-qmx-course-template] .slide{padding:20px 22px!important}body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-process{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:760px){body[data-qmx-course-template] .slide{padding:16px!important}.qmx-template-layer{inset:16px}.qmx-template-layer-list{grid-template-columns:1fr}body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image{grid-template-columns:1fr!important}body[data-qmx-course-template="highly-interactive"] .qmx-native-media{display:none}}
@media(prefers-reduced-motion:reduce){.slide[data-qmx-template-stage="true"] *{transition:none!important}}
</style>`;
}

function runtimeScript(templateId, descriptors) {
    return `<script id="${SCRIPT_ID}">
(function(){
  var TEMPLATE=${safeJson(safeAttr(templateId))};
  var DESCRIPTORS=${safeJson(descriptors)};
  var fitting=false;
  var hotspotPositions=[[24,30],[72,25],[30,72],[75,68],[50,48]];
  function node(slide){return slide&&(slide.querySelector(':scope > .qmx-cover-shell,:scope > .qmx-learning-shell,:scope > .qmx-quiz-shell,:scope > .qmx-final-shell')||slide.firstElementChild);}
  function available(slide){var s=getComputedStyle(slide);return {w:Math.max(1,slide.clientWidth-parseFloat(s.paddingLeft||0)-parseFloat(s.paddingRight||0)),h:Math.max(1,slide.clientHeight-parseFloat(s.paddingTop||0)-parseFloat(s.paddingBottom||0))};}
  function ratio(slide,n){var a=available(slide),r=n.getBoundingClientRect(),w=Math.max(n.scrollWidth||0,r.width||0,1),h=Math.max(n.scrollHeight||0,r.height||0,1);return Math.min(1,a.w/w,a.h/h);}
  function fit(slide){if(!slide||!slide.classList.contains('active'))return;var n=node(slide);if(!n)return;n.style.transform='';slide.classList.remove('qmx-stage-tight','qmx-stage-critical');var r=ratio(slide,n);if(r<.88){slide.classList.add('qmx-stage-tight');r=ratio(slide,n);}if(r<.76){slide.classList.add('qmx-stage-critical');r=ratio(slide,n);}r=Math.min(1,Math.max(.1,r));if(r<.999)n.style.transform='scale('+r.toFixed(4)+')';slide.setAttribute('data-qmx-fit-scale',r.toFixed(4));}
  function fitActive(){if(fitting)return;fitting=true;requestAnimationFrame(function(){fitting=false;fit(document.querySelector('.slide.active'));});}
  function make(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
  function cards(slide){return Array.prototype.slice.call(slide.querySelectorAll('.qmx-cards .qmx-card'));}
  function cardText(card){var p=card.querySelector('p');return String(p&&p.textContent||'').replace(/\\s+/g,' ').trim();}
  function focusReveal(slide){var list=cards(slide),copy=slide.querySelector('.qmx-copy');if(!list.length||!copy)return;var trigger=make('button','qmx-focus-trigger','Reveal key takeaways');trigger.type='button';copy.appendChild(trigger);var layer=make('div','qmx-template-layer'),panel=make('div','qmx-template-layer-card'),close=make('button','qmx-template-layer-close','×'),items=make('div','qmx-template-layer-list');close.type='button';close.setAttribute('aria-label','Close key takeaways');panel.appendChild(close);panel.appendChild(make('h3','','Key takeaways'));list.forEach(function(c,i){items.appendChild(make('div','qmx-template-layer-item',String(i+1).padStart(2,'0')+'  '+cardText(c)));});panel.appendChild(items);layer.appendChild(panel);slide.appendChild(layer);function open(v){layer.classList.toggle('is-open',v);setTimeout(fitActive,0);}trigger.onclick=function(){open(true);};close.onclick=function(){open(false);};layer.onclick=function(e){if(e.target===layer)open(false);};}
  function hotspot(slide){var figure=slide.querySelector('.qmx-native-media'),list=cards(slide),copy=slide.querySelector('.qmx-copy');if(!figure||!list.length||!copy)return;slide.classList.add('qmx-hotspot-ready');var panel=make('div','qmx-hotspot-panel'),label=make('div','qmx-hotspot-panel-label','Explore point 01'),detail=make('p','',cardText(list[0]));panel.appendChild(label);panel.appendChild(detail);copy.appendChild(panel);list.slice(0,5).forEach(function(c,i){var m=make('button','qmx-hotspot-marker',String(i+1));m.type='button';m.style.left=hotspotPositions[i][0]+'%';m.style.top=hotspotPositions[i][1]+'%';m.onclick=function(){Array.prototype.forEach.call(figure.querySelectorAll('.qmx-hotspot-marker'),function(x){x.classList.remove('is-selected');});m.classList.add('is-selected');label.textContent='Explore point '+String(i+1).padStart(2,'0');detail.textContent=cardText(c);};figure.appendChild(m);});var first=figure.querySelector('.qmx-hotspot-marker');if(first)first.classList.add('is-selected');}
  function steps(slide){var list=slide.querySelectorAll('.qmx-step');if(!list.length)return;Array.prototype.forEach.call(list,function(step,i){step.setAttribute('role','button');step.setAttribute('tabindex','0');function select(){Array.prototype.forEach.call(list,function(x){x.classList.remove('is-selected');});step.classList.add('is-selected');}step.onclick=select;step.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};if(i===0)select();});}
  function disableGenericFlip(slide,interaction){if(interaction==='click_reveal')return;Array.prototype.forEach.call(slide.querySelectorAll('.qmx-cards'),function(grid){grid.classList.remove('qmx-cards');grid.classList.add('qmx-static-cards');});}
  function decorate(slide){slide.setAttribute('data-qmx-template-stage','true');var section=Number(slide.getAttribute('data-section')||0),d=section?DESCRIPTORS[section-1]:null;if(!d)return;slide.setAttribute('data-qmx-layout-id',d.layoutId||'');slide.setAttribute('data-qmx-interaction',d.interaction||'focus_reveal');slide.setAttribute('data-qmx-screen-type',d.screenType||'concept');var p=slide.querySelector('.qmx-copy > p');if(p&&d.displayContent){p.textContent=d.displayContent;p.setAttribute('data-qmx-display-content','true');}if(d.interaction==='focus_reveal')focusReveal(slide);if(d.interaction==='hotspot_explore')hotspot(slide);if(d.interaction==='step_explore')steps(slide);disableGenericFlip(slide,d.interaction);}
  function install(){document.documentElement.classList.add('qmx-template-stage-root');if(!document.body)return;document.body.setAttribute('data-qmx-course-template',TEMPLATE);Array.prototype.forEach.call(document.querySelectorAll('.slide'),decorate);fitActive();addEventListener('resize',fitActive,{passive:true});document.addEventListener('click',function(){setTimeout(fitActive,0);setTimeout(fitActive,220)},true);var observer=new MutationObserver(function(m){if(m.length)fitActive();});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-expanded','data-qmx-revealed']});[40,160,420,900].forEach(function(ms){setTimeout(fitActive,ms);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function injectTemplateRuntime(html, analysis) {
    let source = String(html || '');
    if (!source || !shouldUseTemplateRuntime(analysis)) return source;
    const templateId = analysis.templateBinding.templateId;
    const descriptors = slideDescriptors(analysis);
    if (!source.includes(STYLE_ID)) source = source.replace('</head>', `${runtimeStyle(templateId)}\n</head>`);
    if (!source.includes(SCRIPT_ID)) source = source.replace('</head>', `${runtimeScript(templateId, descriptors)}\n</head>`);
    return source;
}

async function applyTemplateRuntimeToZip(zipBuffer, analysis) {
    if (!shouldUseTemplateRuntime(analysis)) return zipBuffer;
    const zip = await JSZip.loadAsync(zipBuffer);
    const htmlNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir && /\.html?$/i.test(name));
    let changed = false;
    for (const name of htmlNames) {
        const html = await zip.file(name).async('string');
        const patched = injectTemplateRuntime(html, analysis);
        if (patched !== html) { zip.file(name, patched); changed = true; }
    }
    return changed ? zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }) : zipBuffer;
}

module.exports = { STYLE_ID, SCRIPT_ID, applyTemplateRuntimeToZip, injectTemplateRuntime, runtimeScript, shouldUseTemplateRuntime, slideDescriptors };
