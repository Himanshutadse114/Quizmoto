'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'quizmoto-visual-product-runtime-v2';
const SCRIPT_ID = 'quizmoto-visual-product-script-v2';

function style() {
    return `<style id="${STYLE_ID}">
body[data-qmx-course-template="visual-product-training"]{--qmx-visual-glow:color-mix(in srgb,var(--primary) 22%,transparent)}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-template-stage="true"].active{padding:clamp(12px,2.2vh,24px) clamp(16px,2.3vw,34px)!important;align-items:center!important;justify-content:center!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell{width:min(1380px,100%)!important;max-width:none!important;min-height:0!important;align-items:stretch!important;gap:clamp(22px,3vw,48px)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.has-image{grid-template-columns:minmax(360px,.72fr) minmax(560px,1.28fr)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.has-image .qmx-copy{align-self:center!important;min-width:0!important;padding:clamp(10px,2vh,26px) 0!important}
body[data-qmx-course-template="visual-product-training"] .qmx-copy>.eyebrow{margin-bottom:8px!important;letter-spacing:.13em!important}
body[data-qmx-course-template="visual-product-training"] .qmx-copy h2{font-size:clamp(32px,3.25vw,50px)!important;line-height:1.03!important;max-width:650px!important;margin-bottom:14px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-copy>p{font-size:14.5px!important;line-height:1.52!important;max-width:620px!important;color:var(--ink-soft)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-native-media{position:relative!important;align-self:center!important;width:100%!important;height:min(72vh,610px)!important;min-height:390px!important;aspect-ratio:auto!important;border-radius:28px!important;border:1px solid color-mix(in srgb,var(--primary) 28%,var(--paper-3))!important;background:linear-gradient(145deg,var(--surface),var(--paper-2))!important;box-shadow:0 28px 70px rgba(15,23,42,.14),0 0 0 8px color-mix(in srgb,var(--primary) 5%,transparent)!important;overflow:hidden!important}
body[data-qmx-course-template="visual-product-training"] .qmx-native-media img{width:100%!important;height:100%!important;object-fit:cover!important;transition:transform .45s cubic-bezier(.2,.72,.22,1),filter .35s ease!important}
body[data-qmx-course-template="visual-product-training"] .qmx-native-media:hover img{transform:scale(1.018)}
body[data-qmx-course-template="visual-product-training"] .qmx-native-media::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.025),transparent 42%,rgba(0,0,0,.035));z-index:1}

/* Product tour hotspot overlay */
.qmx-visual-marker-layer{position:absolute;inset:0;z-index:4;pointer-events:none}
.qmx-visual-marker{position:absolute;width:42px;height:42px;border:2px solid var(--surface);border-radius:999px;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800;box-shadow:0 0 0 7px var(--qmx-visual-glow),0 8px 24px rgba(15,23,42,.24);cursor:pointer;pointer-events:auto;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
.qmx-visual-marker::after{content:"";position:absolute;inset:-9px;border:1px solid color-mix(in srgb,var(--primary) 42%,transparent);border-radius:inherit;animation:qmxVisualPulse 2.2s ease-out infinite}
.qmx-visual-marker:hover,.qmx-visual-marker:focus-visible{transform:scale(1.11);outline:none;box-shadow:0 0 0 9px color-mix(in srgb,var(--primary) 20%,transparent),0 10px 28px rgba(15,23,42,.28)}
.qmx-visual-marker.is-active{background:var(--primary-dark);transform:scale(1.12)}
.qmx-visual-marker.is-visited::after{animation:none;opacity:.25}
.qmx-visual-marker:nth-child(1){left:16%;top:22%}.qmx-visual-marker:nth-child(2){right:17%;top:27%}.qmx-visual-marker:nth-child(3){left:28%;bottom:19%}.qmx-visual-marker:nth-child(4){right:24%;bottom:18%}
@keyframes qmxVisualPulse{0%{transform:scale(.72);opacity:.85}75%,100%{transform:scale(1.55);opacity:0}}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-explore-grid{grid-template-columns:1fr!important;gap:7px!important;margin-top:18px!important}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-explore-option{min-height:44px!important;border-radius:12px!important;background:color-mix(in srgb,var(--surface) 94%,var(--primary) 6%)!important}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-hotspot-panel{border-radius:16px!important;margin-top:9px!important;background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--soft) 46%,var(--surface)))!important;box-shadow:0 12px 28px rgba(15,23,42,.055)!important}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="hotspot_explore"] .qmx-hotspot-panel-label::before{content:"VISUAL CALLOUT · ";opacity:.62}

/* Guided visual steps */
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="step_explore"] .qmx-process{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:20px!important}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="step_explore"] .qmx-step{position:relative;min-height:58px!important;padding:12px 14px 12px 54px!important;border-radius:14px!important;background:var(--surface)!important;border:1px solid var(--paper-3)!important;cursor:pointer!important;transition:transform .18s ease,border-color .18s ease,background .18s ease!important}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="step_explore"] .qmx-step>span{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:29px;height:29px;margin:0!important;display:grid!important;place-items:center;border-radius:9px;background:var(--soft);color:var(--primary-dark)!important}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="step_explore"] .qmx-step.is-selected{transform:translateX(5px);border-color:var(--primary)!important;background:color-mix(in srgb,var(--soft) 58%,var(--surface))!important;box-shadow:0 10px 22px rgba(15,23,42,.07)}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="step_explore"] .qmx-step.is-selected::after{content:"";position:absolute;right:-7px;top:50%;width:14px;height:14px;background:var(--primary);transform:translateY(-50%) rotate(45deg);border-radius:3px}

/* Visual compare */
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="compare_reveal"] .qmx-compare{grid-template-columns:1fr 1fr!important;gap:9px!important;margin-top:20px!important}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="compare_reveal"] .qmx-compare-col{min-height:150px;border-radius:16px!important;padding:16px!important;background:var(--surface)!important;box-shadow:0 10px 25px rgba(15,23,42,.055)}
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="compare_reveal"] .qmx-compare-accent{background:linear-gradient(145deg,var(--soft),var(--surface))!important;border-color:var(--primary)!important}

/* Focus slides are visual hero slides, not card-led slides. */
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="focus_reveal"] .qmx-cards,
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-interaction="focus_reveal"] .qmx-static-cards{display:none!important}
body[data-qmx-course-template="visual-product-training"] .qmx-focus-trigger{margin-top:20px!important;min-height:42px!important;padding:10px 16px!important;border-radius:12px!important;box-shadow:0 10px 24px var(--qmx-visual-glow)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-template-layer-card{border-radius:22px!important;background:linear-gradient(145deg,var(--surface),var(--paper))!important}

/* No-image fallback becomes a designed visual board instead of an empty canvas. */
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board{display:block!important;width:min(1260px,100%)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy{display:grid!important;grid-template-columns:minmax(0,.78fr) minmax(480px,1.22fr)!important;grid-template-rows:auto auto 1fr!important;column-gap:clamp(30px,4vw,58px)!important;align-items:center!important;width:100%!important;padding:0!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.eyebrow,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>h2,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>p{grid-column:1!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-process,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-compare,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-static-cards,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-explore-grid{grid-column:2!important;grid-row:1 / span 3!important;align-self:center!important;margin:0!important;padding:20px!important;border:1px solid color-mix(in srgb,var(--primary) 24%,var(--paper-3))!important;border-radius:26px!important;background:radial-gradient(circle at 80% 12%,color-mix(in srgb,var(--primary) 13%,transparent),transparent 32%),linear-gradient(145deg,var(--surface),var(--paper-2))!important;box-shadow:0 24px 58px rgba(15,23,42,.1)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-hotspot-panel{grid-column:2!important;grid-row:4!important;margin-top:10px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-static-cards{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-static-cards>.qmx-card{min-height:118px!important;border-radius:16px!important;display:flex!important;flex-direction:column!important;justify-content:center!important}

body[data-qmx-course-template="visual-product-training"] .qmx-cover-shell{width:min(1360px,100%)!important;grid-template-columns:minmax(0,.72fr) minmax(560px,1.28fr)!important;gap:44px!important;padding:clamp(28px,4vh,48px)!important;border-radius:26px!important;background:radial-gradient(circle at 86% 18%,color-mix(in srgb,var(--primary) 12%,transparent),transparent 34%),var(--surface)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-cover-shell .qmx-native-media{height:min(65vh,540px)!important;min-height:360px!important}

@media(max-width:1100px){
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.has-image{grid-template-columns:minmax(0,.82fr) minmax(430px,1.18fr)!important;gap:24px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-native-media{min-height:320px!important;height:min(64vh,500px)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy{grid-template-columns:1fr!important;display:flex!important;flex-direction:column!important;align-items:stretch!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-process,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-compare,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-static-cards,
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.no-image.qmx-visual-board .qmx-copy>.qmx-explore-grid{width:100%!important;margin-top:18px!important;padding:14px!important}
}
@media(max-width:760px){
body[data-qmx-course-template="visual-product-training"] .slide[data-qmx-template-stage="true"].active{padding:10px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-learning-shell.has-image{display:flex!important;flex-direction:column-reverse!important;gap:14px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-native-media{display:block!important;height:34vh!important;min-height:210px!important;border-radius:18px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-copy h2{font-size:clamp(27px,8vw,38px)!important}
.qmx-visual-marker{width:34px;height:34px;font-size:9px;box-shadow:0 0 0 5px var(--qmx-visual-glow),0 6px 16px rgba(15,23,42,.2)}
body[data-qmx-course-template="visual-product-training"] .qmx-cover-shell{grid-template-columns:1fr!important;padding:18px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-cover-shell .qmx-native-media{height:30vh!important;min-height:190px!important}
}
@media(max-height:690px) and (min-width:761px){
body[data-qmx-course-template="visual-product-training"] .qmx-native-media{height:min(60vh,430px)!important;min-height:280px!important}
body[data-qmx-course-template="visual-product-training"] .qmx-copy h2{font-size:clamp(28px,3vw,42px)!important}
body[data-qmx-course-template="visual-product-training"] .qmx-copy>p{font-size:13.5px!important;line-height:1.44!important}
}
@media(prefers-reduced-motion:reduce){.qmx-visual-marker::after{animation:none!important}.qmx-native-media img,.qmx-visual-marker,.qmx-step{transition:none!important}}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  var TEMPLATE='visual-product-training';
  var installed=false;
  function all(selector,root){return Array.prototype.slice.call((root||document).querySelectorAll(selector));}
  function clean(value){return String(value||'').replace(/\\s+/g,' ').trim();}
  function currentTemplate(){return document.body&&document.body.getAttribute('data-qmx-course-template');}
  function markerLabel(option,index){var label=option&&option.querySelector('.qmx-explore-label');return clean(label&&label.textContent)||('Visual callout '+String(index+1));}
  function syncMarkers(slide){var options=all('.qmx-explore-option',slide),markers=all('.qmx-visual-marker',slide);markers.forEach(function(marker,index){var option=options[index];if(!option)return;marker.classList.toggle('is-active',option.classList.contains('is-selected'));marker.classList.toggle('is-visited',option.getAttribute('data-qmx-explore-visited')==='true');marker.setAttribute('aria-pressed',option.classList.contains('is-selected')?'true':'false');});}
  function installHotspots(slide){
    if(slide.getAttribute('data-qmx-visual-hotspots')==='true')return;
    var media=slide.querySelector('.qmx-native-media'),options=all('.qmx-explore-option',slide).slice(0,4);
    if(!media||!options.length)return;
    slide.setAttribute('data-qmx-visual-hotspots','true');
    var layer=document.createElement('div');layer.className='qmx-visual-marker-layer';layer.setAttribute('aria-label','Visual callouts');
    options.forEach(function(option,index){var marker=document.createElement('button');marker.type='button';marker.className='qmx-visual-marker';marker.textContent=String(index+1).padStart(2,'0');marker.setAttribute('aria-label','Open '+markerLabel(option,index));marker.setAttribute('aria-pressed','false');marker.onclick=function(){option.click();setTimeout(function(){syncMarkers(slide);},0);};marker.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();marker.click();}};option.addEventListener('click',function(){setTimeout(function(){syncMarkers(slide);},0);});layer.appendChild(marker);});
    media.appendChild(layer);syncMarkers(slide);
  }
  function installSteps(slide){
    if(slide.getAttribute('data-qmx-visual-steps')==='true')return;
    var steps=all('.qmx-step',slide);if(!steps.length)return;slide.setAttribute('data-qmx-visual-steps','true');
    steps.forEach(function(step,index){step.setAttribute('aria-label','Show visual step '+String(index+1));step.addEventListener('click',function(){all('.qmx-step',slide).forEach(function(x){x.classList.remove('is-selected');});step.classList.add('is-selected');var media=slide.querySelector('.qmx-native-media');if(media){media.setAttribute('data-qmx-visual-step',String(index+1));var image=media.querySelector('img');if(image){image.style.transform='scale('+(index%2===0?'1.018':'1.035')+')';setTimeout(function(){image.style.transform='';},260);}}});});
  }
  function decorateSlide(slide){
    var shell=slide.querySelector('.qmx-learning-shell');if(!shell)return;
    if(shell.classList.contains('no-image'))shell.classList.add('qmx-visual-board');
    var interaction=slide.getAttribute('data-qmx-interaction')||'';
    if(interaction==='hotspot_explore')installHotspots(slide);
    if(interaction==='step_explore')installSteps(slide);
    if(interaction==='focus_reveal'){var trigger=slide.querySelector('.qmx-focus-trigger');if(trigger)trigger.textContent='Open visual notes';}
  }
  function decorate(){if(currentTemplate()!==TEMPLATE)return false;all('.slide[data-qmx-template-stage="true"]').forEach(decorateSlide);return true;}
  function install(){if(installed)return;installed=true;var attempts=0;function ready(){attempts+=1;if(decorate())return;if(attempts<10)setTimeout(ready,60);}ready();document.addEventListener('click',function(e){var slide=e.target&&e.target.closest?e.target.closest('.slide[data-qmx-template-stage="true"]'):null;if(slide)setTimeout(function(){decorateSlide(slide);syncMarkers(slide);},0);},true);window.addEventListener('resize',function(){var active=document.querySelector('.slide.active[data-qmx-template-stage="true"]');if(active)decorateSlide(active);},{passive:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function inject(html, analysis) {
    const source = String(html || '');
    const templateId = String(analysis?.templateBinding?.templateId || '').trim();
    const version = String(analysis?.templateBinding?.templateVersion || '').trim();
    if (!source || templateId !== 'visual-product-training' || version !== '1.1.0') return source;
    let patched = source;
    if (!patched.includes(STYLE_ID)) patched = patched.replace('</head>', `${style()}\n</head>`);
    if (!patched.includes(SCRIPT_ID)) patched = patched.replace('</head>', `${script()}\n</head>`);
    return patched;
}

async function applyVisualProductRuntimeToZip(zipBuffer, analysis) {
    if (analysis?.templateBinding?.templateId !== 'visual-product-training' || analysis?.templateBinding?.templateVersion !== '1.1.0') {
        return zipBuffer;
    }
    const zip = await JSZip.loadAsync(zipBuffer);
    const htmlNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir && /\.html?$/i.test(name));
    let changed = false;
    for (const name of htmlNames) {
        const html = await zip.file(name).async('string');
        const patched = inject(html, analysis);
        if (patched !== html) {
            zip.file(name, patched);
            changed = true;
        }
    }
    return changed
        ? zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        : zipBuffer;
}

module.exports = { STYLE_ID, SCRIPT_ID, applyVisualProductRuntimeToZip, inject, script, style };
