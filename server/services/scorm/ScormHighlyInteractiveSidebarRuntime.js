'use strict';

const STYLE_ID = 'quizmoto-highly-interactive-sidebar-v4';
const SCRIPT_ID = 'quizmoto-highly-interactive-sidebar-script-v4';

function style() {
    return `<style id="${STYLE_ID}">
.qmx-course-body{display:flex;flex:1 1 auto;min-height:0;min-width:0;overflow:hidden;position:relative}
.qmx-course-main{flex:1 1 auto;min-width:0;min-height:0;position:relative}
.qmx-course-sidebar{display:none}
body[data-qmx-course-template="highly-interactive"] footer{height:76px!important;min-height:76px!important;padding:10px 28px 12px!important;align-items:center!important}
body[data-qmx-course-template="highly-interactive"] footer .nav-btn{min-height:44px!important;padding:10px 18px!important}
body[data-qmx-course-template="highly-interactive"] #next-btn[data-qmx-interaction-locked="true"]{visibility:hidden!important;pointer-events:none!important}
body[data-qmx-course-template="highly-interactive"] .qmx-process,
body[data-qmx-course-template="highly-interactive"] .qmx-static-cards,
body[data-qmx-course-template="highly-interactive"] .qmx-compare{align-items:stretch!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-step,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-static-cards .qmx-card,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-compare-col{justify-content:flex-start!important;align-items:flex-start!important;text-align:left!important;padding:18px!important;gap:8px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-step span,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-static-cards .qmx-card>span{margin-bottom:10px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-step p,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-static-cards .qmx-card p,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.no-image .qmx-compare-col p{width:100%;text-align:left!important;line-height:1.48!important}
body[data-qmx-course-template="highly-interactive"] .qmx-flip-face{justify-content:flex-start!important;align-items:flex-start!important;text-align:left!important;padding:16px 17px!important;gap:10px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-flip-back p{width:100%;font-size:14px!important;line-height:1.48!important;text-align:left!important}
body[data-qmx-course-template="highly-interactive"] .qmx-focus-trigger{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:48px!important;padding:12px 22px!important;margin:22px 0 14px!important;border-radius:999px!important;box-sizing:border-box!important;line-height:1.15!important;white-space:nowrap!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-cards,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-static-cards,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-process{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-flow:row!important;grid-auto-rows:minmax(128px,1fr)!important;gap:12px!important;width:100%!important;max-width:100%!important;margin-top:18px!important;align-items:stretch!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-card,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-step{height:auto!important;min-height:128px!important;justify-content:flex-start!important;align-items:flex-start!important;text-align:left!important;padding:16px 17px!important;gap:8px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-card>span,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-step>span{margin-bottom:8px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-card p,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-step p{width:100%;margin:0!important;font-size:14px!important;line-height:1.42!important;text-align:left!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-cards.qmx-flip-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:repeat(2,minmax(128px,1fr))!important;max-width:100%!important;gap:12px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-flip-card,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-flip-inner,
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-flip-face{height:100%!important;min-height:128px!important}
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-cards,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="focus_reveal"] .qmx-static-cards,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-guided-explore-ready .qmx-cards,
body[data-qmx-course-template="highly-interactive"] .slide[data-qmx-interaction="hotspot_explore"].qmx-guided-explore-ready .qmx-static-cards{display:none!important}
@media(min-width:1500px){
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar{display:flex;flex:0 0 252px;width:252px;min-width:252px;min-height:0;flex-direction:column;border-right:1px solid var(--paper-3,#d8e5e2);background:linear-gradient(180deg,var(--surface,#fff) 0%,var(--paper,#f3f8f7) 100%);color:var(--ink,#10211f);box-shadow:10px 0 28px rgba(15,52,48,.035);z-index:12;overflow:hidden}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-head{padding:20px 18px 15px;border-bottom:1px solid var(--paper-3,#d8e5e2)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-kicker{font-size:9px;line-height:1;text-transform:uppercase;letter-spacing:.11em;font-weight:800;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-title{margin-top:8px;font-size:14px;line-height:1.28;font-weight:750;color:var(--ink,#10211f);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-progress{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:13px;font-size:10px;color:var(--ink-soft,#49625e)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-progress strong{font-size:10px;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-list{flex:1 1 auto;min-height:0;width:100%;max-width:100%;overflow-y:auto;overflow-x:hidden;overscroll-behavior-x:none;padding:12px 10px 16px;scrollbar-width:thin;scrollbar-color:rgba(17,109,99,.25) transparent}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-list::-webkit-scrollbar{width:6px;height:0}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-list::-webkit-scrollbar-thumb{background:rgba(17,109,99,.24);border-radius:999px}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item{width:100%;max-width:100%;min-width:0;box-sizing:border-box;display:grid;grid-template-columns:32px minmax(0,1fr) 18px;align-items:center;gap:9px;margin:3px 0;padding:9px 8px;border:0;border-radius:11px;background:transparent;color:var(--ink-soft,#49625e);text-align:left;cursor:default;overflow:hidden;transition:background .18s ease,color .18s ease,transform .18s ease}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-visited{cursor:pointer;color:var(--ink,#10211f)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-visited:hover{background:rgba(17,146,134,.075)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-active{background:var(--soft,#dff4f0);color:var(--ink,#10211f);box-shadow:inset 3px 0 0 var(--primary,#119286)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-number{width:30px;height:30px;min-width:30px;display:grid;place-items:center;border:1px solid var(--paper-3,#d8e5e2);border-radius:10px;background:var(--surface,#fff);font-size:10px;line-height:1;font-weight:800;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-active .qmx-course-nav-number{border-color:var(--primary,#119286);background:var(--primary,#119286);color:#fff}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-copy{display:block;min-width:0;overflow:hidden}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-type{display:block;font-size:8px;line-height:1.1;text-transform:uppercase;letter-spacing:.07em;font-weight:750;color:var(--primary-dark,#087f75);opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-label{display:-webkit-box;margin-top:3px;font-size:11px;line-height:1.28;font-weight:620;white-space:normal;overflow:hidden;text-overflow:ellipsis;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-state{display:grid;place-items:center;min-width:0;font-size:11px;font-weight:800;color:var(--primary,#119286);text-align:center}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item:not(.is-visited):not(.is-active){opacity:.58}
body[data-qmx-course-template="highly-interactive"] .qmx-copy h2{font-size:clamp(38px,3.25vw,56px)!important;max-width:900px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-copy>p{font-size:16px!important;line-height:1.54!important;max-width:840px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-native-media{height:min(80%,540px)!important;min-height:320px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-card p,body[data-qmx-course-template="highly-interactive"] .qmx-step p,body[data-qmx-course-template="highly-interactive"] .qmx-compare-col p{font-size:15px!important;line-height:1.46!important}
}
@media(max-width:900px){body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-cards,body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-static-cards,body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-process{grid-template-columns:1fr!important;grid-auto-rows:auto!important}}
@media(max-height:720px){body[data-qmx-course-template="highly-interactive"] footer{height:68px!important;min-height:68px!important;padding:8px 22px 9px!important}body[data-qmx-course-template="highly-interactive"] .qmx-focus-trigger{min-height:44px!important;padding:10px 18px!important;margin:16px 0 10px!important}}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  var state={maxVisited:0,lastIndex:-1,navigating:false};
  function make(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function slides(){return Array.prototype.slice.call(document.querySelectorAll('main .slide'));}
  function activeSlide(){return document.querySelector('main .slide.active');}
  function activeIndex(){var list=slides(),active=activeSlide();return Math.max(0,list.indexOf(active));}
  function clean(value){return String(value||'').replace(/\\s+/g,' ').trim();}
  function courseTitle(){var h=document.querySelector('#app>header h1,header h1'),cover=document.querySelector('.slide[data-kind="cover"] h2');return clean((h&&h.textContent)||(cover&&cover.textContent)||'Course contents');}
  function itemMeta(slide,index,quizNo){var kind=String(slide.getAttribute('data-kind')||'learning');if(kind==='cover')return {type:'Start',label:'Introduction'};if(kind==='final')return {type:'Finish',label:'Course complete'};if(kind==='quiz')return {type:'Knowledge check',label:'Question '+String(quizNo).padStart(2,'0')};var heading=slide.querySelector('.qmx-copy h2,h2');return {type:'Learning',label:clean(heading&&heading.textContent)||('Learning section '+index)};}
  function allMarked(list,attr){return list.length>0&&Array.prototype.every.call(list,function(node){return node.getAttribute(attr)==='true';});}
  function gateStatus(slide){
    if(!slide)return {required:false,complete:true};
    if(slide.getAttribute('data-qmx-interaction-complete')==='true')return {required:true,complete:true};
    var kind=String(slide.getAttribute('data-kind')||'');
    if(kind==='quiz')return {required:true,complete:Boolean(slide.querySelector('.quiz-option.correct,.quiz-option.incorrect'))};
    if(kind!=='learning')return {required:false,complete:true};
    var type=String(slide.getAttribute('data-qmx-interaction')||'');
    if(type==='focus_reveal'){
      var trigger=slide.querySelector('.qmx-focus-trigger');
      return trigger?{required:true,complete:slide.getAttribute('data-qmx-focus-complete')==='true'}:{required:false,complete:true};
    }
    if(type==='hotspot_explore'){
      var explore=slide.querySelectorAll('.qmx-explore-option');
      return explore.length?{required:true,complete:allMarked(explore,'data-qmx-explore-visited')}:{required:false,complete:true};
    }
    if(type==='step_explore'){
      var steps=slide.querySelectorAll('.qmx-step');
      return steps.length?{required:true,complete:allMarked(steps,'data-qmx-step-visited')}:{required:false,complete:true};
    }
    if(type==='click_reveal'){
      var flips=slide.querySelectorAll('.qmx-flip-card');
      if(flips.length)return {required:true,complete:allMarked(flips,'data-qmx-revealed')};
      var raw=slide.querySelectorAll('.qmx-cards .qmx-card');
      return raw.length?{required:true,complete:false}:{required:false,complete:true};
    }
    return {required:false,complete:true};
  }
  function clearLegacyRevealGate(next){
    if(!next)return;
    next.removeAttribute('data-qmx-reveal-locked');
    if(next.title==='Reveal every key point before continuing')next.removeAttribute('title');
    if(next.getAttribute('aria-label')==='Reveal every key point before continuing')next.removeAttribute('aria-label');
  }
  function syncNextGate(){
    var next=document.getElementById('next-btn'),slide=activeSlide();if(!next||!slide)return;
    var status=gateStatus(slide),locked=status.required&&!status.complete;
    slide.setAttribute('data-qmx-interaction-gated',status.required?'true':'false');
    if(status.required&&status.complete)slide.setAttribute('data-qmx-interaction-complete','true');
    if(locked){next.disabled=true;next.setAttribute('data-qmx-interaction-locked','true');next.setAttribute('aria-hidden','true');return;}
    clearLegacyRevealGate(next);
    next.removeAttribute('data-qmx-interaction-locked');
    next.removeAttribute('aria-hidden');
    next.disabled=false;
  }
  function syncGateSoon(){setTimeout(syncNextGate,0);setTimeout(syncNextGate,80);setTimeout(syncNextGate,220);}
  function handleInteraction(event){
    var target=event.target&&event.target.closest?event.target:null;if(!target)return;
    var slide=target.closest('.slide');if(!slide)return;
    var focus=target.closest('.qmx-focus-trigger');if(focus){slide.setAttribute('data-qmx-focus-complete','true');slide.setAttribute('data-qmx-interaction-complete','true');syncGateSoon();return;}
    var explore=target.closest('.qmx-explore-option');if(explore){explore.setAttribute('data-qmx-explore-visited','true');syncGateSoon();return;}
    var step=target.closest('.qmx-step');if(step){step.setAttribute('data-qmx-step-visited','true');syncGateSoon();return;}
    if(target.closest('.qmx-flip-card')||target.closest('.quiz-option'))syncGateSoon();
  }
  function build(){if(document.querySelector('.qmx-course-sidebar'))return;var main=document.querySelector('main');if(!main||!main.parentNode)return;var list=slides();if(!list.length)return;var holder=make('div','qmx-course-body');main.parentNode.insertBefore(holder,main);var aside=make('aside','qmx-course-sidebar');aside.setAttribute('aria-label','Course contents');var head=make('div','qmx-course-sidebar-head');head.appendChild(make('div','qmx-course-sidebar-kicker','Course contents'));head.appendChild(make('div','qmx-course-sidebar-title',courseTitle()));var prog=make('div','qmx-course-sidebar-progress');prog.appendChild(make('span','','Your progress'));var progValue=make('strong','qmx-course-sidebar-progress-value','Part 1 of '+list.length);prog.appendChild(progValue);head.appendChild(prog);aside.appendChild(head);var nav=make('nav','qmx-course-sidebar-list');var quizNo=0;list.forEach(function(slide,i){if(slide.getAttribute('data-kind')==='quiz')quizNo+=1;var meta=itemMeta(slide,i,quizNo),button=make('button','qmx-course-nav-item');button.type='button';button.setAttribute('data-qmx-target',String(i));button.setAttribute('aria-label','Go to '+meta.label);button.title=meta.label;button.appendChild(make('span','qmx-course-nav-number',String(i+1).padStart(2,'0')));var copy=make('span','qmx-course-nav-copy');copy.appendChild(make('span','qmx-course-nav-type',meta.type));copy.appendChild(make('span','qmx-course-nav-label',meta.label));button.appendChild(copy);button.appendChild(make('span','qmx-course-nav-state',''));button.onclick=function(){navigate(Number(button.getAttribute('data-qmx-target')));};nav.appendChild(button);});aside.appendChild(nav);holder.appendChild(aside);holder.appendChild(main);main.classList.add('qmx-course-main');}
  function sync(force){var list=slides(),idx=activeIndex();state.maxVisited=Math.max(state.maxVisited,idx);syncNextGate();if(!force&&idx===state.lastIndex)return;state.lastIndex=idx;var value=document.querySelector('.qmx-course-sidebar-progress-value');if(value)value.textContent='Part '+(idx+1)+' of '+list.length;Array.prototype.forEach.call(document.querySelectorAll('.qmx-course-nav-item'),function(button){var target=Number(button.getAttribute('data-qmx-target')),active=target===idx,visited=target<=state.maxVisited;button.classList.toggle('is-active',active);button.classList.toggle('is-visited',visited);button.disabled=!visited&&!active;button.setAttribute('aria-current',active?'step':'false');var mark=button.querySelector('.qmx-course-nav-state');if(mark)mark.textContent=active?'•':(target<state.maxVisited?'✓':'');});}
  function navigate(target){if(state.navigating||!Number.isFinite(target)||target<0||target>state.maxVisited)return;state.navigating=true;var guard=0;function done(){state.navigating=false;sync(true);if(typeof window.requestAnimationFrame==='function')requestAnimationFrame(function(){window.dispatchEvent(new Event('resize'));});}function step(){var current=activeIndex();if(current===target||guard++>40){done();return;}var id=target<current?'prev-btn':'next-btn',button=document.getElementById(id);if(!button||button.disabled||getComputedStyle(button).display==='none'){done();return;}var before=current;button.click();setTimeout(function(){if(activeIndex()===before){done();return;}step();},45);}step();}
  function seedResume(){var idx=activeIndex();slides().forEach(function(slide,i){if(i<idx)slide.setAttribute('data-qmx-interaction-complete','true');});state.maxVisited=Math.max(state.maxVisited,idx);}
  function install(){if(!document.body||document.body.getAttribute('data-qmx-course-template')!=='highly-interactive')return;build();seedResume();sync(true);var main=document.querySelector('main');if(main){var observer=new MutationObserver(function(changes){var navChanged=changes.some(function(change){return change.type==='attributes'&&change.attributeName==='class'&&change.target&&change.target.classList&&change.target.classList.contains('slide');});if(navChanged)sync(false);else syncNextGate();});observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-qmx-revealed','data-qmx-step-visited','data-qmx-explore-visited']});}document.addEventListener('click',handleInteraction,true);document.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' ')handleInteraction(event);},true);document.addEventListener('click',function(){setTimeout(function(){sync(false);},0);},true);window.addEventListener('load',function(){setTimeout(syncNextGate,0);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function inject(html, templateId) {
    let source = String(html || '');
    if (!source || String(templateId || '') !== 'highly-interactive') return source;
    if (!source.includes(STYLE_ID)) source = source.replace('</head>', `${style()}\
</head>`);
    if (!source.includes(SCRIPT_ID)) source = source.replace('</head>', `${script()}\
</head>`);
    return source;
}

module.exports = { STYLE_ID, SCRIPT_ID, inject, script, style };
