'use strict';

const STYLE_ID = 'quizmoto-highly-interactive-sidebar-v1';
const SCRIPT_ID = 'quizmoto-highly-interactive-sidebar-script-v1';

function style() {
    return `<style id="${STYLE_ID}">
/* Highly Interactive desktop navigation. It is intentionally isolated from legacy/Professional courses. */
.qmx-course-body{display:flex;flex:1 1 auto;min-height:0;min-width:0;overflow:hidden;position:relative}
.qmx-course-main{flex:1 1 auto;min-width:0;min-height:0;position:relative}
.qmx-course-sidebar{display:none}
@media(min-width:1500px){
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar{display:flex;flex:0 0 252px;width:252px;min-width:252px;min-height:0;flex-direction:column;border-right:1px solid var(--paper-3,#d8e5e2);background:linear-gradient(180deg,var(--surface,#fff) 0%,var(--paper,#f3f8f7) 100%);color:var(--ink,#10211f);box-shadow:10px 0 28px rgba(15,52,48,.035);z-index:12}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-head{padding:20px 18px 15px;border-bottom:1px solid var(--paper-3,#d8e5e2)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-kicker{font-size:9px;line-height:1;text-transform:uppercase;letter-spacing:.11em;font-weight:800;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-title{margin-top:8px;font-size:14px;line-height:1.28;font-weight:750;color:var(--ink,#10211f);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-progress{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:13px;font-size:10px;color:var(--ink-soft,#49625e)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-progress strong{font-size:10px;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-list{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 10px 16px;scrollbar-width:thin;scrollbar-color:rgba(17,109,99,.25) transparent}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-list::-webkit-scrollbar{width:6px}
body[data-qmx-course-template="highly-interactive"] .qmx-course-sidebar-list::-webkit-scrollbar-thumb{background:rgba(17,109,99,.24);border-radius:999px}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item{width:100%;display:grid;grid-template-columns:28px minmax(0,1fr) 16px;align-items:center;gap:8px;margin:2px 0;padding:8px 9px;border:0;border-radius:11px;background:transparent;color:var(--ink-soft,#49625e);text-align:left;cursor:default;transition:background .18s ease,color .18s ease,transform .18s ease}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-visited{cursor:pointer;color:var(--ink,#10211f)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-visited:hover{background:rgba(17,146,134,.075)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-active{background:var(--soft,#dff4f0);color:var(--ink,#10211f);box-shadow:inset 3px 0 0 var(--primary,#119286)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-number{width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--paper-3,#d8e5e2);border-radius:9px;background:var(--surface,#fff);font-size:9px;font-weight:800;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item.is-active .qmx-course-nav-number{border-color:var(--primary,#119286);background:var(--primary,#119286);color:#fff}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-copy{min-width:0}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-type{font-size:8px;line-height:1.1;text-transform:uppercase;letter-spacing:.07em;font-weight:750;color:var(--primary-dark,#087f75);opacity:.72}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-label{margin-top:3px;font-size:11px;line-height:1.25;font-weight:620;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-state{font-size:11px;font-weight:800;color:var(--primary,#119286);text-align:center}
body[data-qmx-course-template="highly-interactive"] .qmx-course-nav-item:not(.is-visited):not(.is-active){opacity:.58}
/* Large desktop density: use the remaining content width more confidently after the sidebar absorbs excess canvas width. */
body[data-qmx-course-template="highly-interactive"] .qmx-copy h2{font-size:clamp(38px,3.25vw,56px)!important;max-width:900px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-copy>p{font-size:16px!important;line-height:1.54!important;max-width:840px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image .qmx-native-media{height:min(80%,540px)!important;min-height:320px!important}
body[data-qmx-course-template="highly-interactive"] .qmx-card p,body[data-qmx-course-template="highly-interactive"] .qmx-step p,body[data-qmx-course-template="highly-interactive"] .qmx-compare-col p{font-size:15px!important;line-height:1.42!important}
}
</style>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  var state={maxVisited:0,lastIndex:-1,navigating:false};
  function make(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function slides(){return Array.prototype.slice.call(document.querySelectorAll('main .slide'));}
  function activeIndex(){var list=slides(),active=document.querySelector('main .slide.active');return Math.max(0,list.indexOf(active));}
  function clean(value){return String(value||'').replace(/\\s+/g,' ').trim();}
  function courseTitle(){var h=document.querySelector('#app>header h1,header h1'),cover=document.querySelector('.slide[data-kind="cover"] h2');return clean((h&&h.textContent)||(cover&&cover.textContent)||'Course contents');}
  function itemMeta(slide,index,quizNo){var kind=String(slide.getAttribute('data-kind')||'learning');if(kind==='cover')return {type:'Start',label:'Introduction'};if(kind==='final')return {type:'Finish',label:'Course complete'};if(kind==='quiz')return {type:'Knowledge check',label:'Question '+String(quizNo).padStart(2,'0')};var heading=slide.querySelector('.qmx-copy h2,h2');return {type:'Section '+String(index).padStart(2,'0'),label:clean(heading&&heading.textContent)||('Learning section '+index)};}
  function build(){if(document.querySelector('.qmx-course-sidebar'))return;var main=document.querySelector('main');if(!main||!main.parentNode)return;var list=slides();if(!list.length)return;var holder=make('div','qmx-course-body');main.parentNode.insertBefore(holder,main);var aside=make('aside','qmx-course-sidebar');aside.setAttribute('aria-label','Course contents');var head=make('div','qmx-course-sidebar-head');head.appendChild(make('div','qmx-course-sidebar-kicker','Course contents'));head.appendChild(make('div','qmx-course-sidebar-title',courseTitle()));var prog=make('div','qmx-course-sidebar-progress');prog.appendChild(make('span','','Your progress'));var progValue=make('strong','qmx-course-sidebar-progress-value','Part 1 of '+list.length);prog.appendChild(progValue);head.appendChild(prog);aside.appendChild(head);var nav=make('nav','qmx-course-sidebar-list');var quizNo=0;list.forEach(function(slide,i){if(slide.getAttribute('data-kind')==='quiz')quizNo+=1;var meta=itemMeta(slide,i,quizNo),button=make('button','qmx-course-nav-item');button.type='button';button.setAttribute('data-qmx-target',String(i));button.setAttribute('aria-label','Go to '+meta.label);button.title=meta.label;button.appendChild(make('span','qmx-course-nav-number',String(i+1).padStart(2,'0')));var copy=make('span','qmx-course-nav-copy');copy.appendChild(make('span','qmx-course-nav-type',meta.type));copy.appendChild(make('span','qmx-course-nav-label',meta.label));button.appendChild(copy);button.appendChild(make('span','qmx-course-nav-state',''));button.onclick=function(){navigate(Number(button.getAttribute('data-qmx-target')));};nav.appendChild(button);});aside.appendChild(nav);holder.appendChild(aside);holder.appendChild(main);main.classList.add('qmx-course-main');sync(true);}
  function sync(force){var list=slides(),idx=activeIndex();state.maxVisited=Math.max(state.maxVisited,idx);if(!force&&idx===state.lastIndex)return;state.lastIndex=idx;var value=document.querySelector('.qmx-course-sidebar-progress-value');if(value)value.textContent='Part '+(idx+1)+' of '+list.length;Array.prototype.forEach.call(document.querySelectorAll('.qmx-course-nav-item'),function(button){var target=Number(button.getAttribute('data-qmx-target')),active=target===idx,visited=target<=state.maxVisited;button.classList.toggle('is-active',active);button.classList.toggle('is-visited',visited);button.disabled=!visited&&!active;button.setAttribute('aria-current',active?'step':'false');var mark=button.querySelector('.qmx-course-nav-state');if(mark)mark.textContent=active?'•':(target<state.maxVisited?'✓':'');});}
  function navigate(target){if(state.navigating||!Number.isFinite(target)||target<0||target>state.maxVisited)return;state.navigating=true;var guard=0;function done(){state.navigating=false;sync(true);if(typeof window.requestAnimationFrame==='function')requestAnimationFrame(function(){window.dispatchEvent(new Event('resize'));});}function step(){var current=activeIndex();if(current===target||guard++>40){done();return;}var id=target<current?'prev-btn':'next-btn',button=document.getElementById(id);if(!button||button.disabled||getComputedStyle(button).display==='none'){done();return;}var before=current;button.click();setTimeout(function(){if(activeIndex()===before){done();return;}step();},45);}step();}
  function install(){if(!document.body||document.body.getAttribute('data-qmx-course-template')!=='highly-interactive')return;build();sync(true);var main=document.querySelector('main');if(main){var observer=new MutationObserver(function(changes){var changed=changes.some(function(change){return change.type==='attributes'&&change.attributeName==='class'&&change.target&&change.target.classList&&change.target.classList.contains('slide');});if(changed)sync(false);});observer.observe(main,{subtree:true,attributes:true,attributeFilter:['class']});}document.addEventListener('click',function(){setTimeout(function(){sync(false);},0);},true);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function inject(html, templateId) {
    let source = String(html || '');
    if (!source || String(templateId || '') !== 'highly-interactive') return source;
    if (!source.includes(STYLE_ID)) source = source.replace('</head>', `${style()}\n</head>`);
    if (!source.includes(SCRIPT_ID)) source = source.replace('</head>', `${script()}\n</head>`);
    return source;
}

module.exports = { STYLE_ID, SCRIPT_ID, inject, script, style };
