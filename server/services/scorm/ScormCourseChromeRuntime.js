'use strict';

const JSZip = require('jszip');

const STYLE_ID = 'quizmoto-course-chrome-v1';
const SCRIPT_ID = 'quizmoto-course-chrome-script-v1';

function safeAttr(value) {
    return String(value || '').replace(/[^a-z0-9_.-]/gi, '').slice(0, 120);
}

function style() {
    return `<style id="${STYLE_ID}">
.qmx-course-body,.qmx-scenario-body{display:flex!important;flex:1 1 auto!important;min-width:0!important;min-height:0!important;overflow:hidden!important;position:relative!important}
.qmx-course-main,.qmx-scenario-main{flex:1 1 auto!important;min-width:0!important;min-height:0!important;position:relative!important}
body[data-qmx-course-template] .qmx-course-sidebar,
body[data-qmx-course-template] .qmx-scenario-sidebar{display:flex!important;flex:0 0 232px!important;width:232px!important;min-width:232px!important;min-height:0!important;flex-direction:column!important;border-right:1px solid var(--paper-3,#d8e5e2)!important;background:linear-gradient(180deg,var(--surface,#fff) 0%,var(--paper,#f3f8f7) 100%)!important;color:var(--ink,#10211f)!important;box-shadow:10px 0 28px rgba(15,52,48,.035)!important;z-index:12!important;overflow:hidden!important}
body[data-qmx-course-template] .qmx-course-sidebar-head,
body[data-qmx-course-template] .qmx-scenario-sidebar-head{padding:18px 16px 14px!important;border-bottom:1px solid var(--paper-3,#d8e5e2)!important}
body[data-qmx-course-template] .qmx-course-sidebar-kicker,
body[data-qmx-course-template] .qmx-scenario-sidebar-kicker{font-size:9px!important;line-height:1!important;text-transform:uppercase!important;letter-spacing:.1em!important;font-weight:800!important;color:var(--primary-dark,#087f75)!important}
body[data-qmx-course-template] .qmx-course-sidebar-title,
body[data-qmx-course-template] .qmx-scenario-sidebar-title{margin-top:8px!important;font-size:13.5px!important;line-height:1.3!important;font-weight:750!important;color:var(--ink,#10211f)!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}
body[data-qmx-course-template] .qmx-course-sidebar-progress,
body[data-qmx-course-template] .qmx-scenario-sidebar-progress{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin-top:12px!important;font-size:10px!important;color:var(--ink-soft,#49625e)!important}
body[data-qmx-course-template] .qmx-course-sidebar-progress strong,
body[data-qmx-course-template] .qmx-scenario-sidebar-progress strong{font-size:10px!important;color:var(--primary-dark,#087f75)!important}
body[data-qmx-course-template] .qmx-course-sidebar-list,
body[data-qmx-course-template] .qmx-scenario-sidebar-list{flex:1 1 auto!important;min-height:0!important;width:100%!important;max-width:100%!important;overflow-y:auto!important;overflow-x:hidden!important;padding:10px 9px 14px!important;scrollbar-width:thin!important;scrollbar-color:rgba(17,109,99,.25) transparent!important}
body[data-qmx-course-template] .qmx-course-nav-item,
body[data-qmx-course-template] .qmx-scenario-nav-item{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;display:grid!important;grid-template-columns:30px minmax(0,1fr) 16px!important;align-items:center!important;gap:8px!important;margin:3px 0!important;padding:8px 7px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:var(--ink-soft,#49625e)!important;text-align:left!important;overflow:hidden!important;transition:background .18s ease,color .18s ease!important}
body[data-qmx-course-template] .qmx-course-nav-item.is-visited,
body[data-qmx-course-template] .qmx-scenario-nav-item.is-visited{cursor:pointer!important;color:var(--ink,#10211f)!important}
body[data-qmx-course-template] .qmx-course-nav-item.is-visited:hover,
body[data-qmx-course-template] .qmx-scenario-nav-item.is-visited:hover{background:rgba(17,146,134,.075)!important}
body[data-qmx-course-template] .qmx-course-nav-item.is-active,
body[data-qmx-course-template] .qmx-scenario-nav-item.is-active{background:var(--soft,#dff4f0)!important;color:var(--ink,#10211f)!important;box-shadow:inset 3px 0 0 var(--primary,#119286)!important}
body[data-qmx-course-template] .qmx-course-nav-number,
body[data-qmx-course-template] .qmx-scenario-nav-number{display:grid!important;place-items:center!important;width:28px!important;height:28px!important;min-width:28px!important;border:1px solid var(--paper-3,#d8e5e2)!important;border-radius:9px!important;background:var(--surface,#fff)!important;font-size:9px!important;line-height:1!important;font-weight:800!important;color:var(--primary-dark,#087f75)!important}
body[data-qmx-course-template] .qmx-course-nav-item.is-active .qmx-course-nav-number,
body[data-qmx-course-template] .qmx-scenario-nav-item.is-active .qmx-scenario-nav-number{border-color:var(--primary,#119286)!important;background:var(--primary,#119286)!important;color:#fff!important}
body[data-qmx-course-template] .qmx-course-nav-copy,
body[data-qmx-course-template] .qmx-scenario-nav-copy{display:block!important;min-width:0!important;overflow:hidden!important}
body[data-qmx-course-template] .qmx-course-nav-type,
body[data-qmx-course-template] .qmx-scenario-nav-type{display:block!important;font-size:8px!important;line-height:1.1!important;text-transform:uppercase!important;letter-spacing:.07em!important;font-weight:750!important;color:var(--primary-dark,#087f75)!important;opacity:.72!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
body[data-qmx-course-template] .qmx-course-nav-label,
body[data-qmx-course-template] .qmx-scenario-nav-label{display:-webkit-box!important;margin-top:3px!important;font-size:10.7px!important;line-height:1.28!important;font-weight:640!important;white-space:normal!important;overflow:hidden!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow-wrap:anywhere!important}
body[data-qmx-course-template] .qmx-course-nav-state,
body[data-qmx-course-template] .qmx-scenario-nav-state{display:grid!important;place-items:center!important;font-size:11px!important;font-weight:850!important;color:var(--primary,#119286)!important}
body[data-qmx-course-template] .qmx-course-nav-item:not(.is-visited):not(.is-active),
body[data-qmx-course-template] .qmx-scenario-nav-item:not(.is-visited):not(.is-active){opacity:.52!important;cursor:default!important}

body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column[data-qmx-template-stage="true"].active{align-items:center!important;justify-content:center!important;padding:18px 24px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image{display:flex!important;align-items:center!important;justify-content:center!important;width:min(1240px,100%)!important;height:100%!important;max-width:none!important;min-height:0!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy{width:min(1160px,100%)!important;height:auto!important;max-height:100%!important;min-height:0!important;display:grid!important;grid-template-columns:minmax(0,.86fr) minmax(420px,1.14fr)!important;grid-template-rows:auto auto auto auto!important;column-gap:clamp(38px,4vw,62px)!important;row-gap:12px!important;align-content:center!important;align-items:start!important;justify-content:stretch!important;padding:0!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.eyebrow{grid-column:1!important;grid-row:1!important;margin:0 0 2px!important;align-self:end!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>h2{grid-column:1!important;grid-row:2!important;margin:8px 0 14px!important;max-width:560px!important;font-size:clamp(34px,3vw,50px)!important;line-height:1.04!important;align-self:start!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>p{grid-column:1!important;grid-row:3 / span 2!important;margin:0!important;max-width:560px!important;font-size:15.5px!important;line-height:1.52!important;align-self:start!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-grid{grid-column:2!important;grid-row:1 / span 2!important;margin:0!important;align-self:end!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-panel{grid-column:2!important;grid-row:3!important;margin:0!important;align-self:start!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-instruction{grid-column:2!important;grid-row:4!important;margin:0!important;align-self:start!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-choice-banner{grid-column:2!important;grid-row:1!important;margin:0 0 10px!important;align-self:end!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-choice-banner+.qmx-scenario-grid{grid-row:2!important;align-self:start!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-reveal{grid-column:2!important;grid-row:1!important;margin:0!important;align-self:end!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-reveal+.qmx-scenario-panel{grid-row:2 / span 2!important;margin-top:12px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-reveal+.qmx-scenario-panel+.qmx-scenario-instruction{grid-row:4!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-scenario-option{min-height:76px!important;padding:11px 13px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-scenario-panel{padding:14px 16px 15px 18px!important}

@media(max-width:1180px){
body[data-qmx-course-template] .qmx-course-sidebar,
body[data-qmx-course-template] .qmx-scenario-sidebar{flex-basis:198px!important;width:198px!important;min-width:198px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy{grid-template-columns:1fr!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:0!important;width:min(840px,100%)!important;padding:12px 0!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>*{grid-column:auto!important;grid-row:auto!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-grid{margin-top:18px!important;align-self:stretch!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-panel{margin-top:12px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-instruction{margin-top:10px!important}
body[data-qmx-course-template="scenario-learning"] .slide.qmx-scenario-two-column .qmx-learning-shell.no-image .qmx-copy>.qmx-scenario-reveal{margin-top:18px!important;align-self:flex-start!important}
}
@media(max-width:760px){
body[data-qmx-course-template] .qmx-course-sidebar,
body[data-qmx-course-template] .qmx-scenario-sidebar{flex:0 0 66px!important;width:66px!important;min-width:66px!important}
body[data-qmx-course-template] .qmx-course-sidebar-head,
body[data-qmx-course-template] .qmx-scenario-sidebar-head{padding:13px 8px 11px!important;text-align:center!important}
body[data-qmx-course-template] .qmx-course-sidebar-title,
body[data-qmx-course-template] .qmx-scenario-sidebar-title,
body[data-qmx-course-template] .qmx-course-sidebar-progress,
body[data-qmx-course-template] .qmx-scenario-sidebar-progress{display:none!important}
body[data-qmx-course-template] .qmx-course-sidebar-kicker,
body[data-qmx-course-template] .qmx-scenario-sidebar-kicker{font-size:7px!important;letter-spacing:.05em!important}
body[data-qmx-course-template] .qmx-course-sidebar-list,
body[data-qmx-course-template] .qmx-scenario-sidebar-list{padding:8px 6px 12px!important}
body[data-qmx-course-template] .qmx-course-nav-item,
body[data-qmx-course-template] .qmx-scenario-nav-item{grid-template-columns:1fr!important;place-items:center!important;padding:7px 4px!important;gap:0!important}
body[data-qmx-course-template] .qmx-course-nav-copy,
body[data-qmx-course-template] .qmx-scenario-nav-copy,
body[data-qmx-course-template] .qmx-course-nav-state,
body[data-qmx-course-template] .qmx-scenario-nav-state{display:none!important}
}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  var state={maxVisited:0,lastIndex:-1,navigating:false};
  function make(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function clean(value){return String(value||'').replace(/\\s+/g,' ').trim();}
  function slides(){return Array.prototype.slice.call(document.querySelectorAll('main .slide'));}
  function activeSlide(){return document.querySelector('main .slide.active');}
  function activeIndex(){var list=slides(),active=activeSlide();return Math.max(0,list.indexOf(active));}
  function courseTitle(){var h=document.querySelector('#app>header h1,header h1'),cover=document.querySelector('.slide[data-kind="cover"] h2');return clean((h&&h.textContent)||(cover&&cover.textContent)||'Course');}
  function itemMeta(slide,index,quizNo){var kind=String(slide.getAttribute('data-kind')||'learning');if(kind==='cover')return {type:'Start',label:'Introduction'};if(kind==='final')return {type:'Finish',label:'Course complete'};if(kind==='quiz')return {type:'Knowledge check',label:'Question '+String(quizNo).padStart(2,'0')};var h=slide.querySelector('.qmx-copy h2,h2');var screen=String(slide.getAttribute('data-qmx-screen-type')||'');return {type:screen==='scenario'?'Scenario':'Learning',label:clean(h&&h.textContent)||('Learning section '+String(index))};}
  function existingSidebar(){return document.querySelector('.qmx-scenario-sidebar,.qmx-course-sidebar');}
  function build(){if(existingSidebar())return;var main=document.querySelector('main');if(!main||!main.parentNode)return;var list=slides();if(!list.length)return;var holder=make('div','qmx-course-body');main.parentNode.insertBefore(holder,main);var aside=make('aside','qmx-course-sidebar');aside.setAttribute('aria-label','Course contents');var head=make('div','qmx-course-sidebar-head');head.appendChild(make('div','qmx-course-sidebar-kicker','Course contents'));head.appendChild(make('div','qmx-course-sidebar-title',courseTitle()));var prog=make('div','qmx-course-sidebar-progress');prog.appendChild(make('span','','Your progress'));prog.appendChild(make('strong','qmx-course-sidebar-progress-value','Part 1 of '+list.length));head.appendChild(prog);aside.appendChild(head);var nav=make('nav','qmx-course-sidebar-list'),quizNo=0;list.forEach(function(slide,i){if(slide.getAttribute('data-kind')==='quiz')quizNo+=1;var meta=itemMeta(slide,i,quizNo),b=make('button','qmx-course-nav-item');b.type='button';b.setAttribute('data-qmx-target',String(i));b.setAttribute('aria-label','Go to '+meta.label);b.title=meta.label;b.appendChild(make('span','qmx-course-nav-number',String(i+1).padStart(2,'0')));var c=make('span','qmx-course-nav-copy');c.appendChild(make('span','qmx-course-nav-type',meta.type));c.appendChild(make('span','qmx-course-nav-label',meta.label));b.appendChild(c);b.appendChild(make('span','qmx-course-nav-state',''));b.onclick=function(){navigate(Number(b.getAttribute('data-qmx-target')));};nav.appendChild(b);});aside.appendChild(nav);holder.appendChild(aside);holder.appendChild(main);main.classList.add('qmx-course-main');}
  function navItems(){return Array.prototype.slice.call(document.querySelectorAll('.qmx-course-nav-item,.qmx-scenario-nav-item'));}
  function progressNodes(){return Array.prototype.slice.call(document.querySelectorAll('.qmx-course-sidebar-progress-value,.qmx-scenario-sidebar-progress-value'));}
  function sync(force){var list=slides();if(!list.length)return;var idx=activeIndex();state.maxVisited=Math.max(state.maxVisited,idx);if(!force&&idx===state.lastIndex)return;state.lastIndex=idx;progressNodes().forEach(function(n){n.textContent='Part '+(idx+1)+' of '+list.length;});navItems().forEach(function(b){var target=Number(b.getAttribute('data-qmx-target')),active=target===idx,visited=target<=state.maxVisited;b.classList.toggle('is-active',active);b.classList.toggle('is-visited',visited);b.disabled=!visited&&!active;b.setAttribute('aria-current',active?'step':'false');var mark=b.querySelector('.qmx-course-nav-state,.qmx-scenario-nav-state');if(mark)mark.textContent=active?'•':(target<state.maxVisited?'✓':'');});}
  function navigate(target){if(state.navigating||!Number.isFinite(target)||target<0||target>state.maxVisited)return;state.navigating=true;var guard=0;function done(){state.navigating=false;sync(true);try{window.dispatchEvent(new Event('resize'));}catch(e){}}function step(){var current=activeIndex();if(current===target||guard++>50){done();return;}var b=document.getElementById(target<current?'prev-btn':'next-btn');if(!b||b.disabled||getComputedStyle(b).display==='none'){done();return;}var before=current;b.click();setTimeout(function(){if(activeIndex()===before){done();return;}step();},45);}step();}
  function decorateScenario(){if(!document.body||document.body.getAttribute('data-qmx-course-template')!=='scenario-learning')return;slides().forEach(function(slide){var shell=slide.querySelector('.qmx-learning-shell.no-image'),copy=shell&&shell.querySelector('.qmx-copy');if(!copy)return;var activity=copy.querySelector('.qmx-scenario-grid,.qmx-scenario-panel,.qmx-scenario-reveal,.qmx-scenario-choice-banner');slide.classList.toggle('qmx-scenario-two-column',Boolean(activity));});}
  function install(){if(!document.body||!document.body.getAttribute('data-qmx-course-template'))return;decorateScenario();build();sync(true);var main=document.querySelector('main');if(main){var observer=new MutationObserver(function(){decorateScenario();sync(false);});observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-qmx-scenario-visited','data-qmx-revealed','data-qmx-step-visited','data-qmx-explore-visited']});}document.addEventListener('click',function(){setTimeout(function(){decorateScenario();sync(false);},0);},true);window.addEventListener('load',function(){setTimeout(function(){decorateScenario();build();sync(true);window.dispatchEvent(new Event('resize'));},0);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function inject(html, templateId) {
    let source = String(html || '');
    if (!source || !safeAttr(templateId)) return source;
    if (!source.includes(STYLE_ID)) source = source.replace('</head>', `${style()}\n</head>`);
    if (!source.includes(SCRIPT_ID)) source = source.replace('</head>', `${script()}\n</head>`);
    return source;
}

async function applyCourseChromeRuntimeToZip(zipBuffer, analysis) {
    const templateId = safeAttr(analysis?.templateBinding?.templateId || '');
    if (!templateId) return zipBuffer;
    const zip = await JSZip.loadAsync(zipBuffer);
    const htmlNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir && /\.html?$/i.test(name));
    let changed = false;
    for (const name of htmlNames) {
        const html = await zip.file(name).async('string');
        const patched = inject(html, templateId);
        if (patched !== html) {
            zip.file(name, patched);
            changed = true;
        }
    }
    return changed
        ? zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        : zipBuffer;
}

module.exports = { STYLE_ID, SCRIPT_ID, applyCourseChromeRuntimeToZip, inject, script, style };
