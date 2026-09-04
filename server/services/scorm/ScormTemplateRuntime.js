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
body[data-qmx-course-template="${id}"] .slide[data-qmx-template-stage="true"]{overflow:hidden!important;overscroll-behavior:none!important;box-sizing:border-box!important}
.slide[data-qmx-template-stage="true"]>.qmx-cover-shell,.slide[data-qmx-template-stage="true"]>.qmx-learning-shell,.slide[data-qmx-template-stage="true"]>.qmx-quiz-shell,.slide[data-qmx-template-stage="true"]>.qmx-final-shell,.slide[data-qmx-template-stage="true"]>.layout,.slide[data-qmx-template-stage="true"]>.hero,.slide[data-qmx-template-stage="true"]>.stage,.slide[data-qmx-template-stage="true"]>.qmx-stage{transform-origin:center center;will-change:transform}
.slide[data-qmx-template-stage="true"] .qmx-copy>p{overflow-wrap:anywhere}
.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-copy h2{font-size:clamp(28px,3.25vw,44px)!important;margin-bottom:12px!important}
.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-copy>p{font-size:14px!important;line-height:1.46!important}
.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-cards,.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-static-cards,.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-process,.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-compare{margin-top:14px!important;gap:8px!important}
.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-card,.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-step,.slide[data-qmx-template-stage="true"].qmx-stage-tight .qmx-compare-col{padding:11px!important}
.slide[data-qmx-template-stage="true"].qmx-stage-critical .qmx-copy h2{font-size:clamp(25px,2.8vw,38px)!important}
.slide[data-qmx-template-stage="true"].qmx-stage-critical .qmx-copy>p{font-size:13px!important;line-height:1.4!important}
.slide[data-qmx-template-stage="true"][data-qmx-fit-scale]{contain:layout paint}
.qmx-static-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}
.qmx-template-layer{position:absolute;inset:34px;z-index:45;display:none;align-items:center;justify-content:center;padding:18px;border-radius:24px;background:rgba(9,28,27,.38);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.qmx-template-layer.is-open{display:flex}
.qmx-template-layer-card{position:relative;width:min(760px,92%);max-height:88%;overflow:hidden;border:1px solid var(--paper-3);border-radius:22px;background:var(--surface);box-shadow:0 24px 70px rgba(15,23,42,.2);padding:28px}
.qmx-template-layer-card h3{margin:0 48px 18px 0;font-size:26px;line-height:1.1;color:var(--ink)}
.qmx-template-layer-close{position:absolute;right:18px;top:18px;width:34px;height:34px;border:1px solid var(--paper-3);border-radius:50%;background:var(--paper);color:var(--ink);cursor:pointer}
.qmx-template-layer-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.qmx-template-layer-item{padding:14px 15px;border:1px solid var(--paper-3);border-radius:14px;background:var(--paper);font-size:14px;line-height:1.4;color:var(--ink-soft)}
.qmx-focus-trigger{margin-top:18px;min-height:42px;padding:10px 16px;border:1px solid var(--primary);border-radius:999px;background:var(--primary);color:#fff;font-weight:650;cursor:pointer}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell{width:min(1240px,100%)!important;gap:30px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-copy h2{font-size:clamp(34px,3.55vw,50px)!important;max-width:760px}
body[data-qmx-course-template="highly-interactive"] .qmx-copy>p{font-size:15px!important;line-height:1.52!important;max-width:720px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-cards,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-static-cards{display:none!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,1fr) minmax(360px,.86fr)!important;gap:42px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-native-media{border-radius:24px;box-shadow:0 20px 48px rgba(15,23,42,.13)}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,1.28fr) minmax(290px,.72fr)!important;gap:28px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-native-media{max-height:310px;aspect-ratio:4/3;border-radius:22px}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-cards.qmx-flip-grid{max-width:720px!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin-top:16px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-flip-inner,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-flip-face{min-height:94px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-flip-face{padding:11px 12px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-process{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;margin-top:18px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-step{min-height:108px;cursor:pointer;transition:transform .2s ease,border-color .2s ease,background .2s ease}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-step:hover,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-step.is-selected{transform:translateY(-3px);border-color:var(--primary);background:var(--soft)}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="compare_reveal"] .qmx-compare{gap:14px!important;margin-top:18px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="compare_reveal"] .qmx-compare-col{min-height:150px;border-radius:18px!important;padding:18px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-learning-shell.has-image{grid-template-columns:minmax(390px,1.05fr) minmax(0,.95fr)!important;gap:34px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-native-media{position:relative;overflow:hidden;border-radius:24px}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-hotspot-ready .qmx-cards,body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-hotspot-ready .qmx-static-cards{display:none!important}
.qmx-hotspot-marker{position:absolute;width:38px;height:38px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;background:var(--primary);color:#fff;font-size:12px;font-weight:800;box-shadow:0 8px 22px rgba(0,0,0,.2);cursor:pointer;transform:translate(-50%,-50%)}
.qmx-hotspot-marker:hover,.qmx-hotspot-marker.is-selected{background:var(--ink);transform:translate(-50%,-50%) scale(1.08)}
.qmx-hotspot-panel{margin-top:18px;padding:16px 18px;border:1px solid var(--paper-3);border-radius:16px;background:var(--surface)}
.qmx-hotspot-panel-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--primary-dark);font-weight:800}
.qmx-hotspot-panel p{margin:7px 0 0!important;font-size:14px!important;line-height:1.45!important;color:var(--ink)!important;font-weight:600!important}
body[data-qmx-course-template="scenario-learning"] .qmx-learning-shell{width:min(1180px,100%)!important}
body[data-qmx-course-template="scenario-learning"] .qmx-copy h2{max-width:760px}
body[data-qmx-course-template="scenario-learning"] .slide[data-qmx-screen-type="scenario"] .qmx-learning-shell{padding:26px;border:1px solid var(--paper-3);border-radius:24px;background:var(--surface)}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.has-image{grid-template-columns:minmax(420px,1.1fr) minmax(0,.9fr)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-native-media{border-radius:16px!important;box-shadow:none!important}
@media(max-width:980px){body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{padding:20px 22px!important}body[data-qmx-course-template="highly-interactive"] .qmx-copy h2{font-size:clamp(28px,4vw,42px)!important}body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="step_explore"] .qmx-process{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:760px){body[data-qmx-course-template] .slide[data-qmx-template-stage="true"]{padding:16px!important}.qmx-template-layer{inset:16px;padding:8px}.qmx-template-layer-card{padding:22px}.qmx-template-layer-list{grid-template-columns:1fr}body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image,body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.has-image{grid-template-columns:1fr!important;gap:14px!important}body[data-qmx-course-template="highly-interactive"] .qmx-native-media{display:none}body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="click_reveal"] .qmx-cards.qmx-flip-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(prefers-reduced-motion:reduce){.slide[data-qmx-template-stage="true"] *{scroll-behavior:auto!important;transition:none!important}}
</style>`;
}

function runtimeScript(templateId, descriptors) {
    const id = safeAttr(templateId);
    return `<script id="${SCRIPT_ID}">
(function(){
  var TEMPLATE=${safeJson(id)};
  var DESCRIPTORS=${safeJson(descriptors)};
  var fitting=false;
  var hotspotPositions=[[24,30],[72,25],[30,72],[75,68],[50,48]];
  function directParagraph(slide){return slide&&slide.querySelector('.qmx-copy > p');}
  function cardsFor(slide){return slide?Array.prototype.slice.call(slide.querySelectorAll('.qmx-cards .qmx-card')):[];}
  function contentNode(slide){if(!slide)return null;return slide.querySelector(':scope > .qmx-cover-shell,:scope > .qmx-learning-shell,:scope > .qmx-quiz-shell,:scope > .qmx-final-shell,:scope > .layout,:scope > .hero,:scope > .stage,:scope > .qmx-stage')||slide.firstElementChild;}
  function availableSize(slide){var cs=window.getComputedStyle(slide);var px=parseFloat(cs.paddingLeft||0)+parseFloat(cs.paddingRight||0);var py=parseFloat(cs.paddingTop||0)+parseFloat(cs.paddingBottom||0);return {w:Math.max(1,slide.clientWidth-px),h:Math.max(1,slide.clientHeight-py)};}
  function measure(slide,node){var available=availableSize(slide);var rect=node.getBoundingClientRect();var width=Math.max(node.scrollWidth||0,rect.width||0,1);var height=Math.max(node.scrollHeight||0,rect.height||0,1);return Math.min(1,available.w/width,available.h/height);}
  function fit(slide){if(!slide||!slide.classList.contains('active'))return;var node=contentNode(slide);if(!node)return;node.style.transform='';slide.classList.remove('qmx-stage-tight','qmx-stage-critical');var raw=measure(slide,node);if(raw<.88){slide.classList.add('qmx-stage-tight');raw=measure(slide,node);}if(raw<.76){slide.classList.add('qmx-stage-critical');raw=measure(slide,node);}var scale=Math.min(1,Math.max(.1,raw));if(scale<.999)node.style.transform='scale('+scale.toFixed(4)+')';slide.setAttribute('data-qmx-fit-scale',scale.toFixed(4));slide.setAttribute('data-qmx-stage-fit',scale<.72?'compressed':'fit');}
  function fitActive(){if(fitting)return;fitting=true;requestAnimationFrame(function(){fitting=false;fit(document.querySelector('.slide.active'));});}
  function descriptorFor(slide){var section=Number(slide&&slide.getAttribute('data-section')||0);return section>0?DESCRIPTORS[section-1]||null:null;}
  function make(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;}
  function cardText(card){var p=card&&card.querySelector('p');return String(p&&p.textContent||'').replace(/\\s+/g,' ').trim();}
  function decorateFocusReveal(slide){if(!slide||slide.getAttribute('data-qmx-focus-ready')==='true')return;var cards=cardsFor(slide);if(!cards.length)return;slide.setAttribute('data-qmx-focus-ready','true');var copy=slide.querySelector('.qmx-copy');if(!copy)return;var trigger=make('button','qmx-focus-trigger','Reveal key takeaways');trigger.type='button';copy.appendChild(trigger);var layer=make('div','qmx-template-layer');layer.setAttribute('aria-hidden','true');var panel=make('div','qmx-template-layer-card');var close=make('button','qmx-template-layer-close','×');close.type='button';close.setAttribute('aria-label','Close key takeaways');panel.appendChild(close);panel.appendChild(make('h3','','Key takeaways'));var list=make('div','qmx-template-layer-list');cards.forEach(function(card,index){var value=cardText(card);if(value)list.appendChild(make('div','qmx-template-layer-item',String(index+1).padStart(2,'0')+'  '+value));});panel.appendChild(list);layer.appendChild(panel);slide.appendChild(layer);function setOpen(open){layer.classList.toggle('is-open',open);layer.setAttribute('aria-hidden',open?'false':'true');setTimeout(fitActive,0);}trigger.addEventListener('click',function(){setOpen(true);});close.addEventListener('click',function(){setOpen(false);});layer.addEventListener('click',function(event){if(event.target===layer)setOpen(false);});}
  function decorateHotspot(slide){if(!slide||slide.getAttribute('data-qmx-hotspot-ready')==='true')return;var figure=slide.querySelector('.qmx-native-media');var cards=cardsFor(slide);var copy=slide.querySelector('.qmx-copy');if(!figure||!cards.length||!copy)return;slide.setAttribute('data-qmx-hotspot-ready','true');slide.classList.add('qmx-hotspot-ready');var panel=make('div','qmx-hotspot-panel');var label=make('div','qmx-hotspot-panel-label','Explore point 01');var detail=make('p','',cardText(cards[0]));panel.appendChild(label);panel.appendChild(detail);copy.appendChild(panel);cards.slice(0,5).forEach(function(card,index){var marker=make('button','qmx-hotspot-marker',String(index+1));marker.type='button';marker.style.left=hotspotPositions[index][0]+'%';marker.style.top=hotspotPositions[index][1]+'%';marker.setAttribute('aria-label','Explore point '+String(index+1));marker.addEventListener('click',function(){Array.prototype.forEach.call(figure.querySelectorAll('.qmx-hotspot-marker'),function(item){item.classList.remove('is-selected');});marker.classList.add('is-selected');label.textContent='Explore point '+String(index+1).padStart(2,'0');detail.textContent=cardText(card);});figure.appendChild(marker);});var first=figure.querySelector('.qmx-hotspot-marker');if(first)first.classList.add('is-selected');}
  function decorateSteps(slide){if(!slide||slide.getAttribute('data-qmx-steps-ready')==='true')return;var steps=slide.querySelectorAll('.qmx-step');if(!steps.length)return;slide.setAttribute('data-qmx-steps-ready','true');Array.prototype.forEach.call(steps,function(step,index){step.setAttribute('role','button');step.setAttribute('tabindex','0');step.setAttribute('aria-label','Explore step '+String(index+1));function select(){Array.prototype.forEach.call(steps,function(item){item.classList.remove('is-selected');});step.classList.add('is-selected');}step.addEventListener('click',select);step.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});});steps[0].classList.add('is-selected');}
  function disableGenericFlip(slide,interaction){if(interaction==='click_reveal')return;Array.prototype.forEach.call(slide.querySelectorAll('.qmx-cards'),function(grid){grid.classList.remove('qmx-cards');grid.classList.add('qmx-static-cards');});}
  function decorateSlide(slide,index){slide.setAttribute('data-qmx-template-stage','true');var descriptor=descriptorFor(slide);if(!descriptor)return;slide.setAttribute('data-qmx-layout',descriptor.layout||'spotlight');slide.setAttribute('data-qmx-layout-id',descriptor.layoutId||'');slide.setAttribute('data-qmx-interaction',descriptor.interaction||'focus_reveal');slide.setAttribute('data-qmx-screen-type',descriptor.screenType||'concept');var paragraph=directParagraph(slide);if(paragraph&&descriptor.displayContent){paragraph.textContent=descriptor.displayContent;paragraph.setAttribute('data-qmx-display-content','true');}if(descriptor.interaction==='focus_reveal')decorateFocusReveal(slide);if(descriptor.interaction==='hotspot_explore')decorateHotspot(slide);if(descriptor.interaction==='step_explore')decorateSteps(slide);disableGenericFlip(slide,descriptor.interaction);}
  function install(){document.documentElement.classList.add('qmx-template-stage-root');if(!document.body)return;document.body.setAttribute('data-qmx-course-template',TEMPLATE);Array.prototype.forEach.call(document.querySelectorAll('.slide'),decorateSlide);fitActive();window.addEventListener('resize',fitActive,{passive:true});document.addEventListener('click',function(){setTimeout(fitActive,0);setTimeout(fitActive,220)},true);var observer=new MutationObserver(function(mutations){for(var i=0;i<mutations.length;i+=1){if(mutations[i].type==='attributes'||mutations[i].type==='childList'){fitActive();break;}});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-expanded','data-qmx-revealed']});[40,160,420,900].forEach(function(ms){setTimeout(fitActive,ms);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function injectTemplateRuntime(html, analysis) {
    let source = String(html || '');
    if (!source || !shouldUseTemplateRuntime(analysis)) return source;
    const templateId = analysis.templateBinding.templateId;
    const descriptors = slideDescriptors(analysis);

    if (!source.includes(STYLE_ID)) {
        const style = runtimeStyle(templateId);
        source = source.includes('</head>') ? source.replace('</head>', `${style}\n</head>`) : `${style}\n${source}`;
    }
    if (!source.includes(SCRIPT_ID)) {
        const script = runtimeScript(templateId, descriptors);
        source = source.includes('</head>') ? source.replace('</head>', `${script}\n</head>`) : `${script}\n${source}`;
    }
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
        if (patched !== html) {
            zip.file(name, patched);
            changed = true;
        }
    }

    return changed
        ? zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        : zipBuffer;
}

module.exports = {
    STYLE_ID,
    SCRIPT_ID,
    applyTemplateRuntimeToZip,
    injectTemplateRuntime,
    runtimeScript,
    shouldUseTemplateRuntime,
    slideDescriptors
};
