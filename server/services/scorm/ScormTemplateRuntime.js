'use strict';

const JSZip = require('jszip');
const { fitSlidePresentationContent } = require('./ScormTemplateContentFitter');
const { inject: injectHighlyInteractiveSidebar } = require('./ScormHighlyInteractiveSidebarRuntime');

const STYLE_ID = 'quizmoto-template-stage-v3';
const SCRIPT_ID = 'quizmoto-template-stage-script-v3';

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
.qmx-focus-trigger{margin-top:24px;min-height:44px;padding:10px 18px;border:1px solid var(--primary);border-radius:999px;background:var(--primary);color:#fff;font-weight:650;cursor:pointer;align-self:flex-start}

/* Highly Interactive owns a real 16:9 learner stage. The legacy renderer remains untouched. */
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"].active{align-items:center!important;justify-content:center!important;padding:12px 24px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-cover-shell,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-learning-shell,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-final-shell{width:var(--qmx-stage-width,min(1360px,100%))!important;height:var(--qmx-stage-height,auto)!important;max-width:none!important;margin:auto!important;min-height:0!important;box-sizing:border-box!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell{gap:34px!important;align-items:stretch!important}
body[data-qmx-course-template="highly-interactive"] .qmx-copy h2{font-size:clamp(34px,3.55vw,50px)!important;max-width:820px}
body[data-qmx-course-template="highly-interactive"] .qmx-copy>p{font-size:15px!important;line-height:1.52!important;max-width:760px!important}

/* No-image interactions use the full lower half of the stage instead of floating in the centre. */
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image{grid-template-columns:1fr!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy{height:100%;min-height:0;display:flex!important;flex-direction:column!important;padding:clamp(16px,2.8vh,30px) clamp(8px,2vw,26px)!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-process,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-compare,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-cards,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-static-cards{flex:1 1 auto;min-height:0!important;width:100%;margin-top:clamp(22px,3.8vh,40px)!important;align-self:stretch}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-process,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-cards,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-static-cards{grid-auto-rows:1fr!important;align-items:stretch!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-card,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-step,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-compare-col{height:100%;min-height:0!important;display:flex;flex-direction:column;justify-content:center}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-cards.qmx-flip-grid{height:100%;max-width:none!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:12px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-flip-card,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-flip-inner,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-flip-face{height:100%!important;min-height:118px!important}

/* Image-led screens receive a consistent image slot inside the stage. */
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,1fr) minmax(390px,.9fr)!important;gap:44px!important;align-items:stretch!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-copy{align-self:center;min-width:0;padding:clamp(12px,2vh,24px) 0}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-native-media{align-self:center;width:100%;height:min(74%,500px)!important;min-height:300px;aspect-ratio:auto!important;border-radius:22px}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-cards,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-static-cards{display:none!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,1fr) minmax(390px,.88fr)!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr)!important;gap:30px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-cards.qmx-flip-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-flip-inner,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-flip-face{min-height:118px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-process{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-step{min-height:118px;cursor:pointer;transition:.2s ease}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-step.is-selected{transform:translateY(-3px);border-color:var(--primary);background:var(--soft)}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-learning-shell.has-image{grid-template-columns:minmax(430px,1.08fr) minmax(0,.92fr)!important;gap:38px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-native-media{position:relative;overflow:hidden;height:min(82%,540px)!important;min-height:330px}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-hotspot-ready .qmx-cards,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-hotspot-ready .qmx-static-cards{display:none!important}
.qmx-hotspot-marker{position:absolute;width:38px;height:38px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;background:var(--primary);color:#fff;font-size:12px;font-weight:800;box-shadow:0 8px 22px rgba(0,0,0,.2);cursor:pointer;transform:translate(-50%,-50%)}
.qmx-hotspot-marker.is-selected{background:var(--ink);transform:translate(-50%,-50%) scale(1.08)}
.qmx-hotspot-panel{margin-top:22px;padding:18px 20px;border:1px solid var(--paper-3);border-radius:16px;background:var(--surface)}
.qmx-hotspot-panel-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--primary-dark);font-weight:800}
.qmx-hotspot-panel p{margin:7px 0 0!important;font-size:14px!important;line-height:1.45!important;color:var(--ink)!important;font-weight:600!important}

/* Quiz, cover and completion screens occupy the same stage so they do not appear as small floating blocks. */
body[data-qmx-course-template="highly-interactive"] .qmx-cover-shell{padding:clamp(30px,4vh,52px)!important;grid-template-columns:minmax(0,1.02fr) minmax(380px,.98fr)!important;gap:44px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-cover-shell .qmx-native-media{height:min(76%,520px)!important;aspect-ratio:auto!important;align-self:center}
body[data-qmx-course-template="highly-interactive"] .qmx-quiz-shell{width:var(--qmx-stage-width,min(1180px,100%))!important;height:var(--qmx-stage-height,auto)!important;display:flex!important;flex-direction:column!important;justify-content:center!important;padding:clamp(34px,5vh,64px) clamp(38px,5vw,76px)!important;border:1px solid var(--paper-3);border-radius:24px;background:var(--surface)}
body[data-qmx-course-template="highly-interactive"] .qmx-quiz-shell .qmx-options{width:min(920px,100%);margin-top:clamp(20px,3vh,34px)}
body[data-qmx-course-template="highly-interactive"] .qmx-final-shell{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:clamp(36px,5vh,68px)!important;border:1px solid var(--paper-3);border-radius:24px;background:var(--surface);text-align:center}

@media(max-height:700px){body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"].active{padding:8px 18px!important}body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy{padding:10px 8px!important}body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-native-media{min-height:240px;height:70%!important}body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-native-media{min-height:260px;height:76%!important}}
@media(max-width:980px){body[data-qmx-course-template] .slide{padding:16px 20px!important}body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-process{grid-template-columns:repeat(2,minmax(0,1fr))!important}body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image{gap:26px!important;grid-template-columns:minmax(0,1fr) minmax(300px,.8fr)!important}}
@media(max-width:760px){body[data-qmx-course-template] .slide{padding:12px!important}.qmx-template-layer{inset:12px}.qmx-template-layer-list{grid-template-columns:1fr}body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-cover-shell,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-learning-shell,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-template-stage="true"]>.qmx-final-shell{width:100%!important;height:100%!important}body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image{grid-template-columns:1fr!important}body[data-qmx-course-template="highly-interactive"] .qmx-native-media{display:none}body[data-qmx-course-template="highly-interactive"] .qmx-cover-shell{grid-template-columns:1fr!important}body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-process,body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-compare,body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-cards,body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-copy>.qmx-static-cards{margin-top:14px!important}}
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
  function stageGeometry(slide){var a=available(slide);if(TEMPLATE!=='highly-interactive'||a.w<760)return {w:a.w,h:a.h};var w=Math.min(1360,a.w),h=Math.min(a.h,w*9/16);w=Math.min(w,h*16/9);return {w:Math.max(1,Math.floor(w)),h:Math.max(1,Math.floor(h))};}
  function applyStageGeometry(slide){if(!slide)return;var g=stageGeometry(slide);slide.style.setProperty('--qmx-stage-width',g.w+'px');slide.style.setProperty('--qmx-stage-height',g.h+'px');slide.setAttribute('data-qmx-stage-size',g.w+'x'+g.h);}
  function ratio(slide,n){var a=available(slide),r=n.getBoundingClientRect(),w=Math.max(n.scrollWidth||0,r.width||0,1),h=Math.max(n.scrollHeight||0,r.height||0,1);return Math.min(1,a.w/w,a.h/h);}
  function fit(slide){if(!slide||!slide.classList.contains('active'))return;applyStageGeometry(slide);var n=node(slide);if(!n)return;n.style.transform='';slide.classList.remove('qmx-stage-tight','qmx-stage-critical');var r=ratio(slide,n);if(r<.94){slide.classList.add('qmx-stage-tight');r=ratio(slide,n);}if(r<.84){slide.classList.add('qmx-stage-critical');r=ratio(slide,n);}r=Math.min(1,Math.max(.1,r));if(r<.999)n.style.transform='scale('+r.toFixed(4)+')';slide.setAttribute('data-qmx-fit-scale',r.toFixed(4));}
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
    return injectHighlyInteractiveSidebar(source, templateId);
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
