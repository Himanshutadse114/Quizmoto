const JSZip = require('jszip');
const { buildScormPackageZip: buildExperiencePackage } = require('./ScormExperiencePackageBuilder');

function assessmentExperienceCss() {
    return `
<style id="quizmoto-assessment-experience-v5">
.qmx-quiz-label{
  display:inline-flex!important;align-items:center!important;gap:7px!important;
  border-radius:999px!important;padding:7px 12px!important;margin-bottom:14px!important;
  font-size:10px!important;font-weight:900!important;text-transform:uppercase!important;letter-spacing:.08em!important;
  background:var(--gamma-ink,#282824)!important;color:#fff!important;
  border:1px solid var(--gamma-ink,#282824)!important;box-shadow:none!important
}
.qmx-quiz-label:before{
  content:""!important;width:7px!important;height:7px!important;border-radius:999px!important;
  background:var(--gamma-highlight,#FCF2B5)!important;box-shadow:0 0 10px rgba(252,242,181,.55)!important
}
.quiz-card.qmx-quiz-scenario,
.quiz-card.qmx-quiz-spot-risk,
.quiz-card.qmx-quiz-best-action,
.quiz-card.qmx-quiz-knowledge-check{
  background:rgba(255,255,255,.42)!important;
  border:1px solid var(--gamma-paper-3,#CBC5B8)!important;
  border-radius:12px!important
}
.qmx-option-letter{display:none!important}
.quiz-option{
  display:flex!important;align-items:flex-start!important;gap:0!important;
  text-align:left!important;padding:15px 16px!important
}
.quiz-option:hover:not(:disabled){transform:translateY(-1px)!important}
.qmx-flip-card{
  perspective:900px;cursor:pointer;min-height:120px;position:relative
}
.qmx-flip-inner{
  position:relative;width:100%;min-height:120px;
  transition:transform .55s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d
}
.qmx-flip-card.is-flipped .qmx-flip-inner{transform:rotateY(180deg)}
.qmx-flip-face{
  position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;
  border-radius:10px;padding:16px;display:flex;flex-direction:column;justify-content:center;
  background:rgba(255,255,255,.35);border:1px solid var(--gamma-paper-3,#CBC5B8);
  color:var(--gamma-ink,#282824)
}
.qmx-flip-back{transform:rotateY(180deg);background:var(--gamma-highlight,#FCF2B5)!important;border-color:#C8B86C!important}
.qmx-flip-hint{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.55;margin-top:8px}
.qmx-flip-title{font-size:13px;font-weight:800;line-height:1.4}
.qmx-reveal-card{
  cursor:pointer;border-radius:10px;padding:16px;
  background:rgba(255,255,255,.28);border:1px solid var(--gamma-paper-3,#CBC5B8);
  transition:background .2s ease,border-color .2s ease,box-shadow .2s ease
}
.qmx-reveal-card:hover{background:rgba(255,255,255,.42)}
.qmx-reveal-card .qmx-reveal-body{
  max-height:0;overflow:hidden;opacity:0;
  transition:max-height .4s ease,opacity .3s ease,margin .3s ease;margin-top:0
}
.qmx-reveal-card.is-open .qmx-reveal-body{max-height:240px;opacity:1;margin-top:10px}
.qmx-reveal-card .qmx-reveal-toggle{
  font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;opacity:.55
}
.qmx-reveal-card.is-open .qmx-reveal-toggle{opacity:.85}
.concept-card.qmx-interactive,
.hub-item.qmx-interactive,
.step.qmx-interactive{
  cursor:pointer;transition:transform .2s ease,box-shadow .2s ease,background .2s ease
}
.concept-card.qmx-interactive:hover,
.hub-item.qmx-interactive:hover,
.step.qmx-interactive:hover{transform:translateY(-2px)}
.concept-card.qmx-interactive.is-open,
.hub-item.qmx-interactive.is-open,
.step.qmx-interactive.is-open{
  background:var(--gamma-highlight,#FCF2B5)!important;border-color:#C8B86C!important
}
@keyframes qmxRise{
  from{opacity:0;transform:translateY(14px)}
  to{opacity:1;transform:none}
}
.qmx-stagger > *:nth-child(1){animation:qmxRise .45s ease both .05s}
.qmx-stagger > *:nth-child(2){animation:qmxRise .45s ease both .12s}
.qmx-stagger > *:nth-child(3){animation:qmxRise .45s ease both .19s}
.qmx-stagger > *:nth-child(4){animation:qmxRise .45s ease both .26s}
.qmx-stagger > *:nth-child(5){animation:qmxRise .45s ease both .33s}
.qmx-stagger > *:nth-child(6){animation:qmxRise .45s ease both .4s}
@media(prefers-reduced-motion:reduce){
  .qmx-flip-inner,.qmx-reveal-card .qmx-reveal-body,.qmx-stagger > *{transition:none!important;animation:none!important}
}
@media(max-width:680px){
  .qmx-quiz-label{font-size:9px!important;margin-bottom:10px!important;padding:6px 10px!important}
  .quiz-option{text-align:left!important}
}
</style>`;
}

function interactionTrackingScript() {
    return `
<script id="quizmoto-scorm-interaction-tracking">
(function(){
  var enhancing=false;
  function assessmentType(question){
    var q=String(question||'').toLowerCase();
    if(/you receive|you notice|you are|your colleague|your customer|a message arrives|a caller|imagine|scenario/.test(q))return 'scenario';
    if(/suspicious|warning sign|red flag|risk indicator|phishing sign|looks unsafe|malicious/.test(q))return 'spot-risk';
    if(/what should|what would|best action|first action|next step|most appropriate|safest/.test(q))return 'best-action';
    return 'knowledge-check';
  }
  function assessmentLabel(type){
    if(type==='scenario')return 'Scenario decision';
    if(type==='spot-risk')return 'Spot the risk';
    if(type==='best-action')return 'Choose the best action';
    return 'Knowledge check';
  }
  function installPresentation(data){
    try{
      (data.quiz||[]).forEach(function(q,qi){
        var container=document.getElementById('opts-'+qi);if(!container)return;
        var card=container.closest?container.closest('.quiz-card'):null;
        var type=String(q.questionType||assessmentType(q.question));
        if(card){
          card.classList.add('qmx-quiz-'+type);
          if(!card.querySelector('.qmx-quiz-label')){
            var label=document.createElement('div');
            label.className='qmx-quiz-label';
            label.textContent=assessmentLabel(type);
            card.insertBefore(label,card.firstChild);
          }
        }
        container.querySelectorAll('.qmx-option-letter').forEach(function(el){el.remove()});
      });
    }catch(e){}
  }
  function enhanceContentInteractions(){
    if(enhancing)return;
    enhancing=true;
    try{
      document.querySelectorAll('.cards-grid .concept-card').forEach(function(card,i){
        if(card.getAttribute('data-qmx-interactive'))return;
        card.setAttribute('data-qmx-interactive','1');
        var text=(card.querySelector('p')&&card.querySelector('p').textContent)||'';
        var numEl=card.querySelector('.concept-number');
        var num=numEl?numEl.textContent:String(i+1);
        card.classList.add('qmx-flip-card','concept-card','reveal');
        while(card.firstChild)card.removeChild(card.firstChild);
        var inner=document.createElement('div');
        inner.className='qmx-flip-inner';
        var front=document.createElement('div');
        front.className='qmx-flip-face qmx-flip-front';
        var frontTitle=document.createElement('div');
        frontTitle.className='qmx-flip-title';
        frontTitle.textContent=num+'. Tap to explore';
        var hint=document.createElement('div');
        hint.className='qmx-flip-hint';
        hint.textContent='Click to reveal';
        front.appendChild(frontTitle);
        front.appendChild(hint);
        var back=document.createElement('div');
        back.className='qmx-flip-face qmx-flip-back';
        var backTitle=document.createElement('div');
        backTitle.className='qmx-flip-title';
        backTitle.textContent=text;
        back.appendChild(backTitle);
        inner.appendChild(front);
        inner.appendChild(back);
        card.appendChild(inner);
        card.addEventListener('click',function(ev){
          ev.stopPropagation();
          card.classList.toggle('is-flipped');
        });
      });

      document.querySelectorAll('.hub-list .hub-item').forEach(function(item){
        if(item.getAttribute('data-qmx-interactive'))return;
        item.setAttribute('data-qmx-interactive','1');
        item.classList.add('qmx-interactive','qmx-reveal-card');
        var parts=[];
        item.childNodes.forEach(function(n){
          if(n.nodeType===3&&String(n.textContent||'').trim())parts.push(String(n.textContent).trim());
        });
        var toggle=document.createElement('div');
        toggle.className='qmx-reveal-toggle';
        toggle.textContent='Click to focus';
        if(parts.length){
          var body=document.createElement('div');
          body.className='qmx-reveal-body';
          body.textContent=parts.join(' ');
          item.childNodes.forEach(function(n){if(n.nodeType===3)n.textContent=''});
          item.appendChild(toggle);
          item.appendChild(body);
        } else {
          item.appendChild(toggle);
        }
        item.addEventListener('click',function(ev){
          ev.stopPropagation();
          item.classList.toggle('is-open');
        });
      });

      document.querySelectorAll('.process').forEach(function(process){
        var steps=process.querySelectorAll('.step');
        steps.forEach(function(step,idx){
          if(step.getAttribute('data-qmx-interactive'))return;
          step.setAttribute('data-qmx-interactive','1');
          step.classList.add('qmx-interactive','qmx-reveal-card');
          var p=step.querySelector('p');
          if(p){
            p.classList.add('qmx-reveal-body');
            if(idx===0)step.classList.add('is-open');
          }
          var toggle=document.createElement('div');
          toggle.className='qmx-reveal-toggle';
          toggle.textContent=idx===0?'Key detail':'Click to reveal';
          step.appendChild(toggle);
          step.addEventListener('click',function(ev){
            ev.stopPropagation();
            step.classList.toggle('is-open');
            toggle.textContent=step.classList.contains('is-open')?'Key detail':'Click to reveal';
          });
        });
      });

      document.querySelectorAll('.cards-grid,.process,.hub-list,.timeline').forEach(function(g){
        g.classList.add('qmx-stagger');
      });
    }catch(e){}
    enhancing=false;
  }
  function install(){
    var data=window.__quizmotoData||{};
    try{
      installPresentation(data);
      enhanceContentInteractions();
    }catch(e){}

    /* Do NOT observe class changes — Next toggles .active and that used to
       re-enter enhance on every navigation, freezing the player. Only watch
       for new nodes (rare) and debounce hard. */
    var timer=null;
    var area=document.getElementById('content-area');
    if(area&&typeof MutationObserver==='function'){
      var observer=new MutationObserver(function(mutations){
        var hasNew=false;
        for(var i=0;i<mutations.length;i++){
          if(mutations[i].addedNodes&&mutations[i].addedNodes.length){hasNew=true;break}
        }
        if(!hasNew)return;
        if(timer)clearTimeout(timer);
        timer=setTimeout(function(){
          try{
            installPresentation(data);
            enhanceContentInteractions();
          }catch(e){}
        },120);
      });
      observer.observe(area,{childList:true,subtree:true});
    }

    var answered=Object.create(null),hits=0,totalQuestions=Math.max(1,(data.quiz||[]).length);
    document.querySelectorAll('.quiz-option').forEach(function(btn){
      if(btn.getAttribute('data-qmx-quiz-bound'))return;
      btn.setAttribute('data-qmx-quiz-bound','1');
      btn.addEventListener('click',function(){
        var qi=Number(btn.getAttribute('data-qi'));
        var oi=Number(btn.getAttribute('data-oi'));
        var q=(data.quiz||[])[qi]||{};
        var correct=Number(q.correctAnswer);

        setTimeout(function(){
          try{
            if(typeof doLMSSetValue==='function'){
              var base='cmi.interactions.'+qi;
              doLMSSetValue(base+'.id','quiz_'+(qi+1));
              doLMSSetValue(base+'.type','choice');
              doLMSSetValue(base+'.student_response',String(oi));
              doLMSSetValue(base+'.result',oi===correct?'correct':'wrong');
              try{doLMSSetValue(base+'.correct_responses.0.pattern',String(correct))}catch(e){}
              if(!answered[qi]){answered[qi]=true;if(oi===correct)hits++}
              var provisional=Math.round((hits/totalQuestions)*100);
              doLMSSetValue('cmi.core.score.min','0');
              doLMSSetValue('cmi.core.score.max','100');
              doLMSSetValue('cmi.core.score.raw',String(provisional));
            }
          }catch(e){}
        },0);

        if(q.explanation){
          setTimeout(function(){
            var fb=document.getElementById('fb-'+qi);
            if(fb){var prefix=oi===correct?'Correct. ':'Review this. ';fb.textContent=prefix+String(q.explanation)}
          },0);
        }
      });
    });
  }
  if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',function(){setTimeout(install,0)});
})();
</script>`;
}

async function buildScormPackageZip(analysis, opts = {}) {
    const buffer = await buildExperiencePackage(analysis, opts);
    const zip = await JSZip.loadAsync(buffer);
    const indexFile = zip.file('index.html');
    if (indexFile) {
        let html = await indexFile.async('string');
        if (!html.includes('quizmoto-assessment-experience-v5')) {
            html = html.replace('</head>', `${assessmentExperienceCss()}\n</head>`);
        } else {
            html = html.replace(/<style id="quizmoto-assessment-experience-v5">[\s\S]*?<\/style>/, assessmentExperienceCss().trim());
        }
        if (!html.includes('quizmoto-scorm-interaction-tracking')) {
            html = html.replace('</body>', `${interactionTrackingScript()}\n</body>`);
        } else {
            html = html.replace(/<script id="quizmoto-scorm-interaction-tracking">[\s\S]*?<\/script>/, interactionTrackingScript().trim());
        }
        zip.file('index.html', html);
    }
    const contentFile = zip.file('content.json');
    if (contentFile) {
        try {
            const content = JSON.parse(await contentFile.async('string'));
            zip.file('content.json', JSON.stringify({
                ...content,
                version: 8,
                experienceVersion: 5,
                assessmentExperienceVersion: 6,
                interactionTracking: 'scorm_1_2_cmi_interactions',
                interactionPersistence: 'background_batched',
                provisionalScoreTracking: true,
                contentInteractions: 'flip_cards_click_reveal'
            }, null, 2));
        } catch (_) {}
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    interactionTrackingScript,
    assessmentExperienceCss
};
