'use strict';

const JSZip = require('jszip');
const { buildScenarioGraph } = require('./ScormScenarioGraphPlanner');

const STYLE_ID = 'quizmoto-scenario-branching-runtime-v2';
const DATA_ID = 'quizmoto-scenario-branching-data-v2';
const SCRIPT_ID = 'quizmoto-scenario-branching-script-v2';

function safeJson(value) {
    return JSON.stringify(value || {})
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

function style() {
    return `<style id="${STYLE_ID}">
body[data-qmx-course-template="scenario-learning"] .qmx-branch-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px;padding:10px 13px;border:1px solid var(--paper-3,#d8e5e2);border-radius:13px;background:var(--paper,#f3f8f7)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-head-copy{min-width:0}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-kicker{font-size:8.5px;line-height:1.2;text-transform:uppercase;letter-spacing:.09em;font-weight:850;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-objective{margin-top:4px;font-size:11.5px;line-height:1.38;font-weight:620;color:var(--ink-soft,#49625e)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-state{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;min-height:30px;padding:6px 10px;border:1px solid var(--paper-3,#d8e5e2);border-radius:999px;background:var(--surface,#fff);font-size:9px;font-weight:800;color:var(--ink,#10211f)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-state::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--primary,#119286);box-shadow:0 0 0 4px rgba(17,146,134,.10)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-state[data-level="caution"]::before{background:#9a6a12;box-shadow:0 0 0 4px rgba(154,106,18,.10)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-state[data-level="high-risk"]::before{background:#a23f3f;box-shadow:0 0 0 4px rgba(162,63,63,.10)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;width:100%;margin-top:13px}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr);grid-template-rows:auto auto;column-gap:11px;row-gap:4px;align-items:center;min-height:78px;padding:12px 14px;border:1px solid var(--paper-3,#d8e5e2);border-radius:14px;background:var(--surface,#fff);color:var(--ink,#10211f);text-align:left;cursor:pointer;box-shadow:0 8px 22px rgba(15,35,32,.035);transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease,background .18s ease}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice:hover,body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice:focus-visible{border-color:var(--primary,#119286);outline:none;transform:translateY(-1px);box-shadow:0 12px 28px rgba(17,146,134,.09)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice.is-selected{border-color:var(--primary,#119286);background:var(--soft,#edf8f6)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice:disabled{cursor:default;opacity:.58;transform:none;box-shadow:none}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice.is-selected:disabled{opacity:1}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-number{grid-row:1/span 2;display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--paper-3,#d8e5e2);border-radius:10px;background:var(--paper,#f3f8f7);font-size:9px;font-weight:850;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice.is-selected .qmx-branch-number{border-color:var(--primary,#119286);background:var(--primary,#119286);color:#fff}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice-label{font-size:13.5px;line-height:1.3;font-weight:730;color:var(--ink,#10211f)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice-hint{font-size:8.5px;line-height:1.2;text-transform:uppercase;letter-spacing:.07em;font-weight:800;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-consequence{margin-top:13px;border:1px solid var(--paper-3,#d8e5e2);border-radius:16px;background:var(--surface,#fff);overflow:hidden;box-shadow:0 10px 30px rgba(15,35,32,.045)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-consequence[hidden]{display:none!important}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-consequence-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--paper-3,#d8e5e2);background:var(--paper,#f3f8f7)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-consequence-title{font-size:9px;text-transform:uppercase;letter-spacing:.09em;font-weight:850;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-effect{font-size:9px;font-weight:800;color:var(--ink-soft,#49625e)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-consequence-body{display:grid;grid-template-columns:1fr 1fr;gap:0}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-panel{padding:14px 16px}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-panel+.qmx-branch-panel{border-left:1px solid var(--paper-3,#d8e5e2)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-panel-label{font-size:8.5px;text-transform:uppercase;letter-spacing:.09em;font-weight:850;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-panel p{margin:6px 0 0!important;font-size:12.5px!important;line-height:1.44!important;font-weight:560!important;color:var(--ink,#10211f)!important}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-continue{display:inline-flex;align-items:center;justify-content:center;min-height:40px;margin:0 14px 14px;padding:9px 16px;border:1px solid var(--primary,#119286);border-radius:999px;background:var(--primary,#119286);color:#fff;font-size:11px;font-weight:780;cursor:pointer}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-continue:hover{filter:brightness(.96)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-note{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:10.5px;line-height:1.35;font-weight:650;color:var(--ink-soft,#49625e)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-note::before{content:'→';display:grid;place-items:center;width:21px;height:21px;flex:0 0 21px;border-radius:50%;background:var(--soft,#edf8f6);color:var(--primary-dark,#087f75);font-size:9px;font-weight:850}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-note.is-complete{color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-note.is-complete::before{content:'✓';background:var(--primary,#119286);color:#fff}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-sidebar-state{margin-top:9px;padding-top:9px;border-top:1px solid var(--paper-3,#d8e5e2);font-size:9.5px;font-weight:750;color:var(--ink-soft,#49625e)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-sidebar-state strong{color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-outcome{width:min(760px,100%);margin:18px auto 0;padding:18px 20px;border:1px solid var(--paper-3,#d8e5e2);border-radius:18px;background:linear-gradient(135deg,var(--surface,#fff),var(--soft,#edf8f6));text-align:left}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-outcome-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;font-weight:850;color:var(--primary-dark,#087f75)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-outcome h3{margin:7px 0 0;font-size:22px;line-height:1.15;color:var(--ink,#10211f)}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-outcome p{margin:8px 0 0!important;font-size:13px!important;line-height:1.48!important;color:var(--ink-soft,#49625e)!important}
body[data-qmx-course-template="scenario-learning"] .qmx-branch-outcome-meta{margin-top:10px;font-size:10px;font-weight:720;color:var(--primary-dark,#087f75)}
@media(max-width:760px){body[data-qmx-course-template="scenario-learning"] .qmx-branch-head{align-items:flex-start;flex-direction:column}body[data-qmx-course-template="scenario-learning"] .qmx-branch-grid{grid-template-columns:1fr}body[data-qmx-course-template="scenario-learning"] .qmx-branch-consequence-body{grid-template-columns:1fr}body[data-qmx-course-template="scenario-learning"] .qmx-branch-panel+.qmx-branch-panel{border-left:0;border-top:1px solid var(--paper-3,#d8e5e2)}}
@media(prefers-reduced-motion:reduce){body[data-qmx-course-template="scenario-learning"] .qmx-branch-choice{transition:none!important}}
</style>`;
}

function dataScript(graph) {
    return `<script id="${DATA_ID}">window.__QMX_SCENARIO_GRAPH__=${safeJson(graph)};</script>`;
}

function script() {
    return `<script id="${SCRIPT_ID}">
(function(){
  var graph=window.__QMX_SCENARIO_GRAPH__;
  if(!graph||graph.version<2||!Array.isArray(graph.nodes)||!graph.decisionCount)return;
  if(window.__qmxScenarioBranchingRuntimeLoaded)return;
  window.__qmxScenarioBranchingRuntimeLoaded=true;
  var nodes={};graph.nodes.forEach(function(n){nodes[n.id]=n;});
  var decisionNodes=graph.nodes.filter(function(n){return n.type==='decision';}).sort(function(a,b){return Number(a.ordinal||0)-Number(b.ordinal||0);});
  var storageKey='qmx-scenario-v2:'+String(location.pathname||'course')+':'+String(graph.startNodeId||'start');
  var slideCache=null,syncPending=false;
  function emptyState(){return {version:2,choices:{},completed:{},path:[]};}
  function load(){try{var raw=sessionStorage.getItem(storageKey);var parsed=raw?JSON.parse(raw):null;return parsed&&parsed.version===2?parsed:emptyState();}catch(e){return emptyState();}}
  var state=load();window.__qmxScenarioState=state;
  function save(){try{sessionStorage.setItem(storageKey,JSON.stringify(state));}catch(e){}window.__qmxScenarioState=state;}
  function clean(v){return String(v||'').replace(/\\s+/g,' ').trim();}
  function make(tag,cls,text){var el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value;}
  function learningSlides(){if(!slideCache)slideCache=Array.prototype.slice.call(document.querySelectorAll('main .slide[data-kind="learning"]'));return slideCache;}
  function riskScore(){return Object.keys(state.choices||{}).reduce(function(sum,id){var c=state.choices[id];return sum+(Number(c&&c.riskDelta)||0);},0);}
  function completedCount(){return Object.keys(state.completed||{}).filter(function(id){return state.completed[id];}).length;}
  function status(){var done=Math.max(1,Object.keys(state.choices||{}).length),avg=riskScore()/done;if(avg<=0)return {id:'on-track',label:'On track'};if(avg<=14)return {id:'caution',label:'Caution'};return {id:'high-risk',label:'High risk'};}
  function outcome(){var avg=riskScore()/Math.max(1,Object.keys(state.choices||{}).length);if(avg<=0)return {id:'protected',label:'Strong judgement',title:'You kept the situation under control',text:'Your decisions consistently added verification, reduced exposure and created safer stopping points before action.'};if(avg<=14)return {id:'caution',label:'Caution needed',title:'You reduced some risk, but not all of it',text:'Several decisions helped, but one or more actions still relied on an unverified request or channel. Independent verification should happen earlier.'};return {id:'high-risk',label:'High-risk path',title:'The situation was allowed to escalate',text:'The decision path created avoidable exposure. Pause, verify independently and report or escalate before taking the requested action.'};}
  function notify(slide){try{slide.dispatchEvent(new CustomEvent('qmx:scenario-update',{bubbles:true}));}catch(e){var ev=document.createEvent('Event');ev.initEvent('qmx:scenario-update',true,true);slide.dispatchEvent(ev);}}
  function removeOldDecisionUi(copy){Array.prototype.forEach.call(copy.querySelectorAll(':scope > .qmx-scenario-choice-banner,:scope > .qmx-scenario-grid.qmx-scenario-decisions,:scope > .qmx-scenario-panel,:scope > .qmx-scenario-instruction'),function(n){n.remove();});}
  function pathEffect(safety){if(safety==='safe')return 'Safer path';if(safety==='risky')return 'Risk increased';return 'Partial safeguard';}
  function renderConsequence(slide,node,choice,container,note,continueButton){
    container.hidden=false;
    var effect=container.querySelector('.qmx-branch-effect'),what=container.querySelector('[data-qmx-branch="consequence"]'),coach=container.querySelector('[data-qmx-branch="coaching"]');
    setText(effect,pathEffect(choice.safety));
    setText(what,clean(choice.consequence)||'Your response changes how the situation develops.');
    setText(coach,clean(choice.coaching)||'Pause and independently verify before taking the requested action.');
    continueButton.hidden=Boolean(state.completed[node.id]);
    if(state.completed[node.id]){note.classList.add('is-complete');setText(note,'Consequence reviewed • continue to the next part');slide.setAttribute('data-qmx-scenario-decision-complete','true');slide.setAttribute('data-qmx-scenario-complete','true');}
  }
  function choose(slide,node,choice,buttons,container,note,continueButton){
    if(state.choices[node.id])return;
    state.choices[node.id]={choiceId:choice.id,safety:choice.safety,riskDelta:Number(choice.riskDelta)||0,nextNodeId:choice.nextNodeId};
    state.path=Array.isArray(state.path)?state.path:[];state.path.push(node.id,choice.nextNodeId);save();
    buttons.forEach(function(b){var selected=b.getAttribute('data-choice-id')===choice.id;b.classList.toggle('is-selected',selected);b.disabled=true;var hint=b.querySelector('.qmx-branch-choice-hint');setText(hint,selected?pathEffect(choice.safety):'Response locked');});
    renderConsequence(slide,node,choice,container,note,continueButton);notify(slide);
  }
  function prepareDecision(node){
    var slide=learningSlides()[Number(node.slideIndex)];if(!slide||slide.getAttribute('data-qmx-branch-owned')==='true')return;
    var copy=slide.querySelector('.qmx-copy');if(!copy)return;
    slide.setAttribute('data-qmx-branch-owned','true');slide.setAttribute('data-qmx-scenario-decision-mode','decision');slide.removeAttribute('data-qmx-scenario-decision-complete');slide.removeAttribute('data-qmx-scenario-complete');
    removeOldDecisionUi(copy);Array.prototype.forEach.call(slide.querySelectorAll('.qmx-cards,.qmx-static-cards,.qmx-scenario-source'),function(n){n.classList.add('qmx-scenario-source');});
    var head=make('div','qmx-branch-head'),headCopy=make('div','qmx-branch-head-copy');headCopy.appendChild(make('div','qmx-branch-kicker','Decision '+String(node.ordinal).padStart(2,'0')+' of '+graph.decisionCount));headCopy.appendChild(make('div','qmx-branch-objective',clean(node.objective)||'Choose the response you would take. Your decision changes the consequence.'));head.appendChild(headCopy);var badge=make('div','qmx-branch-state','Path status');badge.setAttribute('data-qmx-branch-status','true');head.appendChild(badge);copy.appendChild(head);
    var grid=make('div','qmx-branch-grid');copy.appendChild(grid);var buttons=[];
    (node.choices||[]).forEach(function(choice,i){var b=make('button','qmx-branch-choice');b.type='button';b.setAttribute('data-choice-id',choice.id);b.appendChild(make('span','qmx-branch-number',String(i+1).padStart(2,'0')));b.appendChild(make('span','qmx-branch-choice-label',choice.label));b.appendChild(make('span','qmx-branch-choice-hint','Choose this response'));b.onclick=function(){choose(slide,node,choice,buttons,consequence,note,continueButton);};buttons.push(b);grid.appendChild(b);});
    var consequence=make('div','qmx-branch-consequence');consequence.hidden=true;var top=make('div','qmx-branch-consequence-top');top.appendChild(make('div','qmx-branch-consequence-title','Your decision changed the path'));top.appendChild(make('div','qmx-branch-effect',''));consequence.appendChild(top);var body=make('div','qmx-branch-consequence-body');var happened=make('div','qmx-branch-panel');happened.appendChild(make('div','qmx-branch-panel-label','What happened'));var hp=make('p','');hp.setAttribute('data-qmx-branch','consequence');happened.appendChild(hp);var coaching=make('div','qmx-branch-panel');coaching.appendChild(make('div','qmx-branch-panel-label','Coach’s note'));var cp=make('p','');cp.setAttribute('data-qmx-branch','coaching');coaching.appendChild(cp);body.appendChild(happened);body.appendChild(coaching);consequence.appendChild(body);var continueButton=make('button','qmx-branch-continue','Continue this path');continueButton.type='button';continueButton.onclick=function(){state.completed[node.id]=true;save();slide.setAttribute('data-qmx-scenario-decision-complete','true');slide.setAttribute('data-qmx-scenario-complete','true');continueButton.hidden=true;note.classList.add('is-complete');setText(note,'Consequence reviewed • Next is unlocked');notify(slide);};consequence.appendChild(continueButton);copy.appendChild(consequence);var note=make('div','qmx-branch-note','Choose one response, then review the consequence before continuing.');copy.appendChild(note);
    var saved=state.choices[node.id];if(saved){var choice=(node.choices||[]).find(function(c){return c.id===saved.choiceId;})||node.choices[0];buttons.forEach(function(b){var selected=b.getAttribute('data-choice-id')===choice.id;b.classList.toggle('is-selected',selected);b.disabled=true;var hint=b.querySelector('.qmx-branch-choice-hint');setText(hint,selected?pathEffect(choice.safety):'Response locked');});renderConsequence(slide,node,choice,consequence,note,continueButton);}
  }
  function syncSidebar(){var head=document.querySelector('.qmx-scenario-sidebar-head');if(!head)return;var row=head.querySelector('.qmx-branch-sidebar-state');if(!row){row=make('div','qmx-branch-sidebar-state');head.appendChild(row);}var s=status(),html='Decision path: <strong>'+s.label+'</strong> · '+completedCount()+'/'+graph.decisionCount+' completed';if(row.innerHTML!==html)row.innerHTML=html;}
  function syncBadges(){var s=status();Array.prototype.forEach.call(document.querySelectorAll('[data-qmx-branch-status="true"]'),function(b){setText(b,s.label);if(b.getAttribute('data-level')!==s.id)b.setAttribute('data-level',s.id);});}
  function syncOutcome(){var slide=document.querySelector('main .slide[data-kind="final"]'),shell=slide&&slide.querySelector('.qmx-final-shell');if(!shell)return;var card=shell.querySelector('.qmx-branch-outcome');if(!card){card=make('section','qmx-branch-outcome');card.setAttribute('aria-live','polite');card.appendChild(make('div','qmx-branch-outcome-label'));card.appendChild(make('h3',''));card.appendChild(make('p',''));card.appendChild(make('div','qmx-branch-outcome-meta'));shell.appendChild(card);}var result=outcome();if(card.getAttribute('data-outcome')!==result.id)card.setAttribute('data-outcome',result.id);setText(card.querySelector('.qmx-branch-outcome-label'),'Scenario outcome · '+result.label);setText(card.querySelector('h3'),result.title);setText(card.querySelector('p'),result.text);setText(card.querySelector('.qmx-branch-outcome-meta'),completedCount()+' of '+graph.decisionCount+' decisions completed');}
  function syncGlobal(){syncBadges();syncSidebar();syncOutcome();}
  function scheduleGlobalSync(){if(syncPending)return;syncPending=true;setTimeout(function(){syncPending=false;syncGlobal();},0);}
  function install(){
    if(!document.body||document.body.getAttribute('data-qmx-course-template')!=='scenario-learning')return;
    decisionNodes.forEach(prepareDecision);
    syncGlobal();
    document.addEventListener('qmx:scenario-update',scheduleGlobalSync,true);
    window.addEventListener('pageshow',function(){decisionNodes.forEach(prepareDecision);scheduleGlobalSync();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function inject(html, graph) {
    let source = String(html || '');
    if (!source || !graph?.decisionCount) return source;
    if (!source.includes(STYLE_ID)) source = source.replace('</head>', `${style()}\n</head>`);
    if (!source.includes(DATA_ID)) source = source.replace('</head>', `${dataScript(graph)}\n</head>`);
    if (!source.includes(SCRIPT_ID)) source = source.replace('</head>', `${script()}\n</head>`);
    return source;
}

async function applyScenarioBranchingRuntimeToZip(zipBuffer, analysis) {
    if (String(analysis?.templateBinding?.templateId || '') !== 'scenario-learning') return zipBuffer;
    const graph = analysis?.scenarioGraph?.version >= 2 ? analysis.scenarioGraph : buildScenarioGraph(analysis);
    if (!graph?.decisionCount) return zipBuffer;

    const zip = await JSZip.loadAsync(zipBuffer);
    const htmlNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir && /\.html?$/i.test(name));
    let changed = false;
    for (const name of htmlNames) {
        const html = await zip.file(name).async('string');
        const patched = inject(html, graph);
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
    DATA_ID,
    SCRIPT_ID,
    STYLE_ID,
    applyScenarioBranchingRuntimeToZip,
    dataScript,
    inject,
    script,
    style
};