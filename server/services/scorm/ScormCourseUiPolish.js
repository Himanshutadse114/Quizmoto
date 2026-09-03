const COURSE_UI_POLISH_STYLE_ID = 'quizmoto-course-ui-polish-v2';
const TWO_CHOICE_SCENARIO_SCRIPT_ID = 'quizmoto-two-choice-scenario-v1';

const SPEAKER_OFF_MASK = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M11%205%206%209H2v6h4l5%204z'/%3E%3Cpath%20d='m22%209-6%206'/%3E%3Cpath%20d='m16%209%206%206'/%3E%3C/svg%3E";
const SPEAKER_ON_MASK = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M11%205%206%209H2v6h4l5%204z'/%3E%3Cpath%20d='M15.54%208.46a5%205%200%200%201%200%207.07'/%3E%3Cpath%20d='M19.07%204.93a10%2010%200%200%201%200%2014.14'/%3E%3C/svg%3E";

function courseUiPolishStyle() {
    return `<style id="${COURSE_UI_POLISH_STYLE_ID}">
/* Course header: remove the generated Q badge while preserving an uploaded logo. */
header .brand-mark{display:none!important}

/* Narration stays an accessible button, but is presented as a simple speaker vector only. */
#qmx-narration-toggle{
  width:34px!important;
  min-width:34px!important;
  height:34px!important;
  min-height:34px!important;
  padding:0!important;
  margin:0!important;
  border:0!important;
  border-radius:7px!important;
  background:transparent!important;
  box-shadow:none!important;
  color:var(--ink,var(--text,#282824))!important;
  display:inline-grid!important;
  place-items:center!important;
  flex:0 0 34px!important;
  font-size:0!important;
  line-height:0!important;
  text-indent:-9999px!important;
  overflow:hidden!important;
  cursor:pointer!important;
}
#qmx-narration-toggle::before{
  content:""!important;
  width:19px!important;
  height:19px!important;
  display:block!important;
  background:currentColor!important;
  -webkit-mask-image:url("${SPEAKER_OFF_MASK}")!important;
  mask-image:url("${SPEAKER_OFF_MASK}")!important;
  -webkit-mask-repeat:no-repeat!important;
  mask-repeat:no-repeat!important;
  -webkit-mask-position:center!important;
  mask-position:center!important;
  -webkit-mask-size:contain!important;
  mask-size:contain!important;
}
#qmx-narration-toggle[aria-pressed="true"]::before{
  -webkit-mask-image:url("${SPEAKER_ON_MASK}")!important;
  mask-image:url("${SPEAKER_ON_MASK}")!important;
}
#qmx-narration-toggle:hover{background:rgba(40,40,36,.06)!important}
#qmx-narration-toggle:focus-visible{outline:2px solid currentColor!important;outline-offset:2px!important}

/* Assessment questions should read like normal course copy, not oversized headings. */
.slide[data-kind="quiz"] .qmx-quiz-shell,
.slide[data-kind="quiz"] .quiz-card{
  text-align:left!important;
}
.slide[data-kind="quiz"] .qmx-quiz-shell h2,
.slide[data-kind="quiz"] .quiz-card h2,
.slide[data-kind="quiz"] .quiz-card .title,
.qmx-quiz-shell h2,
.quiz-card h2{
  font-size:17px!important;
  font-weight:400!important;
  line-height:1.5!important;
  letter-spacing:0!important;
  text-align:left!important;
  margin:0 0 18px!important;
}

/* Two-Choice Scenario: intentionally text-only. Choices stay on the left and the scenario stays on the right. */
.slide.qmx-two-choice-scenario,
.slide[data-qmx-template="scenario_decision"]{
  background-image:none!important;
}
.slide.qmx-two-choice-scenario .spot-visual,
.slide.qmx-two-choice-scenario .hero-art,
.slide.qmx-two-choice-scenario .hero-core,
.slide.qmx-two-choice-scenario .qmx-runtime-picture,
.slide.qmx-two-choice-scenario picture,
.slide.qmx-two-choice-scenario img,
.slide.qmx-two-choice-scenario .qmx-v7-secondary{
  display:none!important;
}
img[alt*="innvikta" i],
img[alt*="invicta" i],
.innvikta-logo,
.invicta-logo,
[data-brand="innvikta" i],
[data-brand="invicta" i]{display:none!important}
.slide.qmx-two-choice-scenario .qmx-learning-shell,
.slide.qmx-two-choice-scenario .qmx-learning-shell.no-image,
.slide.qmx-two-choice-scenario .qmx-copy{
  display:block!important;
  width:100%!important;
  max-width:none!important;
  grid-template-columns:none!important;
}
.slide.qmx-two-choice-scenario .qmx-runtime-prompt{display:none!important}
.slide.qmx-two-choice-scenario .qmx-v7-runtime{
  width:100%!important;
  max-width:1120px!important;
  margin:0 auto!important;
}
.qmx-two-choice-layout{
  display:grid!important;
  grid-template-columns:minmax(250px,.72fr) minmax(420px,1.28fr)!important;
  gap:24px!important;
  align-items:stretch!important;
  width:100%!important;
}
.qmx-two-choice-actions,
.qmx-two-choice-card{
  min-width:0!important;
  border:1px solid var(--gamma-paper-3,#CBC5B8)!important;
  border-radius:18px!important;
  background:rgba(255,255,255,.42)!important;
  box-shadow:0 14px 34px rgba(40,40,36,.055)!important;
}
.qmx-two-choice-actions{
  padding:22px!important;
  display:flex!important;
  flex-direction:column!important;
  justify-content:center!important;
  gap:12px!important;
}
.qmx-two-choice-card{
  padding:30px 32px!important;
  display:flex!important;
  flex-direction:column!important;
  justify-content:center!important;
}
.qmx-two-choice-label{
  display:block!important;
  margin:0 0 8px!important;
  color:var(--gamma-ink-soft,#5A5A54)!important;
  font-size:10px!important;
  line-height:1.2!important;
  font-weight:900!important;
  text-transform:uppercase!important;
  letter-spacing:.11em!important;
}
.qmx-two-choice-question{
  margin:0!important;
  color:var(--gamma-ink,var(--text,#282824))!important;
  font-size:clamp(20px,2vw,29px)!important;
  line-height:1.32!important;
  font-weight:700!important;
  letter-spacing:-.02em!important;
}
.qmx-two-choice-grid{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:12px!important;
  width:100%!important;
}
.qmx-two-choice-option{
  position:relative!important;
  width:100%!important;
  min-height:74px!important;
  padding:16px 16px 16px 48px!important;
  border:1px solid var(--gamma-paper-3,#CBC5B8)!important;
  border-radius:13px!important;
  background:rgba(255,255,255,.72)!important;
  color:var(--gamma-ink,var(--text,#282824))!important;
  font:inherit!important;
  font-size:14px!important;
  font-weight:700!important;
  line-height:1.42!important;
  text-align:left!important;
  cursor:pointer!important;
  transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease!important;
}
.qmx-two-choice-option::before{
  content:attr(data-choice-letter)!important;
  position:absolute!important;
  left:15px!important;
  top:50%!important;
  transform:translateY(-50%)!important;
  width:23px!important;
  height:23px!important;
  display:grid!important;
  place-items:center!important;
  border-radius:999px!important;
  background:var(--gamma-ink,#282824)!important;
  color:#fff!important;
  font-size:10px!important;
  font-weight:900!important;
}
.qmx-two-choice-option:hover:not(:disabled){
  transform:translateY(-1px)!important;
  border-color:var(--gamma-ink-soft,#696960)!important;
  box-shadow:0 8px 18px rgba(40,40,36,.07)!important;
}
.qmx-two-choice-option:focus-visible{outline:2px solid var(--gamma-ink,#282824)!important;outline-offset:3px!important}
.qmx-two-choice-option.is-selected{border-color:var(--gamma-ink,#282824)!important;background:#fff!important}
.qmx-two-choice-option.is-correct{border-color:#23825C!important;background:#F0FAF5!important;color:#14523B!important}
.qmx-two-choice-option.is-incorrect{border-color:#B84D4D!important;background:#FFF4F4!important;color:#7B3030!important}
.qmx-two-choice-option:disabled{cursor:default!important;opacity:1!important}
.qmx-two-choice-feedback{
  display:none!important;
  margin-top:22px!important;
  padding:14px 15px!important;
  border-radius:11px!important;
  font-size:13px!important;
  font-weight:650!important;
  line-height:1.5!important;
}
.qmx-two-choice-feedback.is-visible{display:block!important}
.qmx-two-choice-feedback.is-correct{background:#F0FAF5!important;border:1px solid #B7E1CF!important;color:#14523B!important}
.qmx-two-choice-feedback.is-incorrect{background:#FFF4F4!important;border:1px solid #EDC7C7!important;color:#7B3030!important}
.qmx-two-choice-progress{
  margin-top:14px!important;
  color:var(--gamma-ink-soft,#66665E)!important;
  font-size:11px!important;
  font-weight:800!important;
  letter-spacing:.02em!important;
}

@media(max-width:820px){
  .qmx-two-choice-layout{grid-template-columns:1fr!important;gap:14px!important}
  .qmx-two-choice-card{grid-row:1!important;padding:22px!important}
  .qmx-two-choice-actions{grid-row:2!important;padding:18px!important}
  .qmx-two-choice-question{font-size:21px!important}
}
@media(max-width:680px){
  .slide[data-kind="quiz"] .qmx-quiz-shell h2,
  .slide[data-kind="quiz"] .quiz-card h2,
  .slide[data-kind="quiz"] .quiz-card .title,
  .qmx-quiz-shell h2,
  .quiz-card h2{font-size:16px!important;line-height:1.5!important}
  #qmx-narration-toggle{width:32px!important;min-width:32px!important;height:32px!important;min-height:32px!important;flex-basis:32px!important}
  #qmx-narration-toggle::before{width:18px!important;height:18px!important}
  .qmx-two-choice-card{padding:20px!important;border-radius:14px!important}
  .qmx-two-choice-actions{padding:15px!important;border-radius:14px!important}
  .qmx-two-choice-option{min-height:66px!important;padding:14px 14px 14px 44px!important;font-size:13px!important}
}
</style>`;
}

function twoChoiceScenarioScript() {
    return `
<script id="${TWO_CHOICE_SCENARIO_SCRIPT_ID}">
(function(){
  var results={};
  function clean(v){return v==null?'':String(v).replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim()}
  function setValue(key,value){try{if(typeof doLMSSetValue==='function')return doLMSSetValue(key,value==null?'':String(value))}catch(e){}return 'false'}
  function getValue(key){try{if(typeof doLMSGetValue==='function')return String(doLMSGetValue(key)||'')}catch(e){}return ''}
  function commit(){try{if(typeof doLMSCommit==='function')doLMSCommit()}catch(e){}}
  function node(tag,className,text){var el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=String(text);return el}
  function loadData(done){
    var embedded=window.__quizmotoData||{};
    if(Array.isArray(embedded.slides)&&embedded.slides.length){done(embedded);return}
    if(typeof window.fetch!=='function'){done(embedded);return}
    window.fetch('content.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('content');return r.json()}).then(function(data){if(data&&typeof data==='object')window.__quizmotoData=data;done(data||embedded)}).catch(function(){done(embedded)})
  }
  function interactionChoices(slideData){
    var interaction=slideData&&slideData.interaction&&typeof slideData.interaction==='object'?slideData.interaction:{};
    var source=Array.isArray(interaction.choices)?interaction.choices:[];
    if(source.length<2)return null;
    var items=source.map(function(item,index){
      if(item&&typeof item==='object')return {text:clean(item.text||item.label||item.title||item.value),correct:item.correct===true||item.isCorrect===true,index:index};
      return {text:clean(item),correct:false,index:index}
    }).filter(function(item){return !!item.text});
    if(items.length<2)return null;
    var authoredCorrect=Number(interaction.correctAnswer!=null?interaction.correctAnswer:interaction.correctIndex);
    var correctOriginal=Number.isInteger(authoredCorrect)&&authoredCorrect>=0&&authoredCorrect<items.length?authoredCorrect:items.findIndex(function(item){return item.correct});
    if(correctOriginal<0)return null;
    var correctItem=items[correctOriginal];
    var distractor=items.find(function(item,idx){return idx!==correctOriginal});
    if(!correctItem||!distractor)return null;
    return {items:[correctItem,distractor],correctOriginal:0,question:clean(interaction.question||interaction.prompt),explanation:clean(interaction.explanation||interaction.feedback)}
  }
  function fromQuiz(data,ordinal){
    var quiz=Array.isArray(data&&data.quiz)?data.quiz:[];
    if(!quiz.length)return null;
    var q=quiz[ordinal%quiz.length]||{};
    var options=Array.isArray(q.options)?q.options.map(clean):[];
    var correct=Number(q.correctAnswer);
    if(options.length<2||!Number.isInteger(correct)||correct<0||correct>=options.length)return null;
    var distractor=options.findIndex(function(value,index){return index!==correct&&!!value});
    if(distractor<0)return null;
    var pair=ordinal%2===0
      ? [{text:options[distractor],sourceIndex:distractor},{text:options[correct],sourceIndex:correct}]
      : [{text:options[correct],sourceIndex:correct},{text:options[distractor],sourceIndex:distractor}];
    return {items:pair,correctOriginal:pair[0].sourceIndex===correct?0:1,question:clean(q.question),explanation:clean(q.explanation)}
  }
  function fallbackScenario(slideData){
    var points=Array.isArray(slideData&&slideData.keyPoints)?slideData.keyPoints.map(clean).filter(Boolean):[];
    if(points.length<2)return null;
    var interaction=slideData&&slideData.interaction&&typeof slideData.interaction==='object'?slideData.interaction:{};
    return {
      items:[{text:points[0]},{text:points[1]}],
      correctOriginal:null,
      question:clean(interaction.question||interaction.prompt||slideData.revealText||slideData.introText||slideData.content||slideData.title)||'Which response would you choose?',
      explanation:clean(interaction.explanation||interaction.feedback||slideData.revealText)
    }
  }
  function scenarioModel(data,slideData,ordinal){
    var authored=interactionChoices(slideData);
    var model=authored||fromQuiz(data,ordinal)||fallbackScenario(slideData);
    if(!model)return null;
    if(!model.question)model.question=clean(slideData&&slideData.title)||'Which response would you choose?';
    if(model.items.length>2)model.items=model.items.slice(0,2);
    return model
  }
  function syncNextGate(){
    var next=document.getElementById('next-btn');if(!next)return;
    var active=document.querySelector('.slide.active');if(!active)return;
    var incomplete=active.querySelector('.qmx-v7-runtime[data-qmx-complete="false"]');
    var unrevealed=active.querySelector('.qmx-flip-card[data-qmx-revealed="false"]');
    var locked=!!incomplete||!!unrevealed;
    if(locked){next.disabled=true;next.setAttribute('data-qmx-reveal-locked','true');next.title='Complete the interaction before continuing';next.setAttribute('aria-label','Complete the interaction before continuing')}
    else if(next.getAttribute('data-qmx-reveal-locked')==='true'){next.disabled=false;next.removeAttribute('data-qmx-reveal-locked');next.removeAttribute('title');next.removeAttribute('aria-label')}
  }
  function updateAggregate(total){
    var keys=Object.keys(results),answered=keys.length,correct=keys.filter(function(k){return results[k]===true}).length;
    var percent=answered?Math.round((correct/answered)*100):0;
    setValue('quizmoto.scenario.count',String(total));
    setValue('quizmoto.scenario.answered',String(answered));
    setValue('quizmoto.scenario.correct',String(correct));
    setValue('quizmoto.scenario.score_raw',String(correct));
    setValue('quizmoto.scenario.score_max',String(total));
    setValue('quizmoto.scenario.score_percent',String(percent));
    setValue('quizmoto.scenario.completed',answered>=total?'true':'false')
  }
  function recordAnswer(ordinal,total,model,selectedIndex){
    var correctIndex=Number.isInteger(model.correctOriginal)?model.correctOriginal:null;
    var selected=model.items[selectedIndex]&&model.items[selectedIndex].text?model.items[selectedIndex].text:'';
    var correctText=correctIndex!=null&&model.items[correctIndex]?model.items[correctIndex].text:'';
    var graded=correctIndex!=null;
    var isCorrect=graded&&selectedIndex===correctIndex;
    var result=graded?(isCorrect?'correct':'incorrect'):'recorded';
    var prefix='quizmoto.scenario.'+ordinal+'.';
    setValue(prefix+'question',model.question||'');
    setValue(prefix+'choice_0',model.items[0]&&model.items[0].text||'');
    setValue(prefix+'choice_1',model.items[1]&&model.items[1].text||'');
    setValue(prefix+'selected',selected);
    setValue(prefix+'correct',correctText);
    setValue(prefix+'selected_index',String(selectedIndex));
    setValue(prefix+'correct_index',correctIndex==null?'':String(correctIndex));
    setValue(prefix+'result',result);
    setValue(prefix+'explanation',model.explanation||'');
    setValue(prefix+'answered','1');
    if(graded)results[ordinal]=isCorrect;else results[ordinal]=null;
    updateAggregate(total);
    commit();
    try{window.dispatchEvent(new CustomEvent('quizmoto:scenario-answer',{detail:{scenarioIndex:ordinal,question:model.question,selectedAnswer:selected,correctAnswer:correctText,selectedIndex:selectedIndex,correctIndex:correctIndex,result:result,explanation:model.explanation||''}}))}catch(e){}
    return {graded:graded,isCorrect:isCorrect,result:result}
  }
  function applyAnsweredState(host,model,buttons,feedback,progress,ordinal,total,selectedIndex,restored){
    var correctIndex=Number.isInteger(model.correctOriginal)?model.correctOriginal:null;
    buttons.forEach(function(btn,index){
      btn.disabled=true;
      btn.classList.toggle('is-selected',index===selectedIndex);
      btn.classList.toggle('is-correct',correctIndex!=null&&index===correctIndex);
      btn.classList.toggle('is-incorrect',correctIndex!=null&&index===selectedIndex&&index!==correctIndex)
    });
    host.setAttribute('data-qmx-complete','true');
    var isCorrect=correctIndex!=null&&selectedIndex===correctIndex;
    feedback.className='qmx-two-choice-feedback is-visible '+(correctIndex==null?'is-correct':(isCorrect?'is-correct':'is-incorrect'));
    if(correctIndex==null)feedback.textContent='Response recorded.'+(model.explanation?' '+model.explanation:'');
    else feedback.textContent=(isCorrect?'Correct. ':'Not quite. ')+(model.explanation||('The correct response is: '+(model.items[correctIndex]&&model.items[correctIndex].text||'')));
    progress.textContent=(restored?'Saved response restored':'Answer recorded')+' · '+(ordinal+1)+' of '+total;
    syncNextGate()
  }
  function enhanceHost(host,data,ordinal,total){
    if(!host||host.getAttribute('data-qmx-two-choice-ready')==='true')return;
    var slide=host.closest?host.closest('.slide'):null;if(!slide)return;
    var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var slideIndex=slides.indexOf(slide);
    var slideData=Array.isArray(data&&data.slides)&&slideIndex>=0?data.slides[slideIndex]||{}:{};
    var model=scenarioModel(data,slideData,ordinal);if(!model||model.items.length!==2)return;

    slide.classList.add('qmx-two-choice-scenario');
    slide.setAttribute('data-qmx-template','scenario_decision');
    host.setAttribute('data-qmx-two-choice-ready','true');
    host.setAttribute('data-qmx-complete','false');
    host.textContent='';

    var layout=node('div','qmx-two-choice-layout');
    var actions=node('section','qmx-two-choice-actions');
    var scenario=node('section','qmx-two-choice-card');
    var actionLabel=node('span','qmx-two-choice-label','Choose one response');
    var scenarioLabel=node('span','qmx-two-choice-label','Scenario');
    var question=node('p','qmx-two-choice-question',model.question);
    var grid=node('div','qmx-two-choice-grid');
    var feedback=node('div','qmx-two-choice-feedback');
    var progress=node('div','qmx-two-choice-progress','Choose an answer to continue · '+(ordinal+1)+' of '+total);
    actions.appendChild(actionLabel);actions.appendChild(grid);actions.appendChild(progress);
    scenario.appendChild(scenarioLabel);scenario.appendChild(question);scenario.appendChild(feedback);
    layout.appendChild(actions);layout.appendChild(scenario);host.appendChild(layout);

    var buttons=model.items.map(function(item,index){
      var btn=node('button','qmx-two-choice-option',item.text);btn.type='button';btn.setAttribute('data-choice-letter',index===0?'A':'B');btn.setAttribute('data-scenario-index',String(ordinal));btn.setAttribute('data-option-index',String(index));grid.appendChild(btn);return btn
    });

    var prefix='quizmoto.scenario.'+ordinal+'.';
    var savedIndex=Number(getValue(prefix+'selected_index'));
    var savedResult=clean(getValue(prefix+'result')).toLowerCase();
    if(Number.isInteger(savedIndex)&&savedIndex>=0&&savedIndex<2&&savedResult){
      if(savedResult==='correct')results[ordinal]=true;else if(savedResult==='incorrect')results[ordinal]=false;else results[ordinal]=null;
      applyAnsweredState(host,model,buttons,feedback,progress,ordinal,total,savedIndex,true);
      updateAggregate(total);
      return
    }

    buttons.forEach(function(btn,index){btn.addEventListener('click',function(){
      if(host.getAttribute('data-qmx-complete')==='true')return;
      recordAnswer(ordinal,total,model,index);
      applyAnsweredState(host,model,buttons,feedback,progress,ordinal,total,index,false)
    })});
    syncNextGate()
  }
  function enhanceWhenReady(data,attempt){
    var hosts=Array.prototype.slice.call(document.querySelectorAll('.qmx-v7-runtime[data-qmx-template="scenario_decision"]'));
    if(!hosts.length&&attempt<50){setTimeout(function(){enhanceWhenReady(data,attempt+1)},100);return}
    hosts.forEach(function(host,ordinal){enhanceHost(host,data,ordinal,hosts.length)});
    if(hosts.length){setValue('quizmoto.scenario.count',String(hosts.length));commit()}
  }
  function install(){loadData(function(data){setTimeout(function(){enhanceWhenReady(data,0)},0)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;
}

function injectCourseUiPolish(source) {
    const html = String(source || '');
    if (!html) return html;

    const additions = [];
    if (!html.includes(COURSE_UI_POLISH_STYLE_ID)) additions.push(courseUiPolishStyle());
    if (!html.includes(TWO_CHOICE_SCENARIO_SCRIPT_ID)) additions.push(twoChoiceScenarioScript());
    if (!additions.length) return html;

    const payload = additions.join('\n');
    return html.includes('</head>')
        ? html.replace('</head>', `${payload}\n</head>`)
        : `${payload}\n${html}`;
}

module.exports = {
    COURSE_UI_POLISH_STYLE_ID,
    TWO_CHOICE_SCENARIO_SCRIPT_ID,
    courseUiPolishStyle,
    twoChoiceScenarioScript,
    injectCourseUiPolish
};
