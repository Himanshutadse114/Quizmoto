const JSZip = require('jszip');
const { buildScormPackageZip: buildExperiencePackage } = require('./ScormExperiencePackageBuilder');

function assessmentExperienceCss() {
    return `
<style id="quizmoto-assessment-experience-v5">
.qmx-quiz-label{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 9px;margin-bottom:13px;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.1em;background:color-mix(in srgb,var(--primary) 16%,var(--surface));color:var(--accent);border:1px solid color-mix(in srgb,var(--primary) 36%,var(--line))}
.qmx-quiz-label:before{content:"";width:6px;height:6px;border-radius:999px;background:var(--accent);box-shadow:0 0 12px color-mix(in srgb,var(--accent) 55%,transparent)}
.quiz-card.qmx-quiz-scenario{background:radial-gradient(circle at 92% 8%,color-mix(in srgb,var(--primary) 15%,transparent),transparent 22rem),linear-gradient(145deg,var(--surface-2),var(--surface))!important}
.quiz-card.qmx-quiz-spot-risk{background:radial-gradient(circle at 92% 8%,rgba(244,63,94,.10),transparent 22rem),linear-gradient(145deg,var(--surface-2),var(--surface))!important}
.quiz-card.qmx-quiz-best-action{background:radial-gradient(circle at 92% 8%,color-mix(in srgb,var(--accent) 10%,transparent),transparent 22rem),linear-gradient(145deg,var(--surface-2),var(--surface))!important}
.qmx-option-letter{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;margin-right:10px;vertical-align:middle;background:color-mix(in srgb,var(--primary) 13%,var(--surface-2));border:1px solid color-mix(in srgb,var(--primary) 30%,var(--line));color:var(--accent);font-size:10px;font-weight:850;transition:inherit}
.quiz-option:hover:not(:disabled) .qmx-option-letter,.quiz-option[aria-pressed="true"] .qmx-option-letter{background:color-mix(in srgb,var(--primary) 30%,var(--surface));color:#fff;border-color:var(--primary)}
.quiz-option.correct .qmx-option-letter{background:#067A5C!important;color:#fff!important;border-color:#34D399!important}.quiz-option.incorrect .qmx-option-letter{background:#8E2942!important;color:#fff!important;border-color:#FB7185!important}
@media(max-width:680px){.qmx-quiz-label{font-size:8.5px;margin-bottom:10px}.qmx-option-letter{width:26px;height:26px;margin-right:8px}.quiz-option{text-align:left!important}}
</style>`;
}

function interactionTrackingScript() {
    return `
<script id="quizmoto-scorm-interaction-tracking">
(function(){
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
    (data.quiz||[]).forEach(function(q,qi){
      var container=document.getElementById('opts-'+qi);if(!container)return;
      var card=container.closest?container.closest('.quiz-card'):null;var type=String(q.questionType||assessmentType(q.question));
      if(card){card.classList.add('qmx-quiz-'+type);if(!card.querySelector('.qmx-quiz-label')){var label=document.createElement('div');label.className='qmx-quiz-label';label.textContent=assessmentLabel(type);card.insertBefore(label,card.firstChild)}}
      container.querySelectorAll('.quiz-option').forEach(function(btn,index){
        if(!btn.querySelector('.qmx-option-letter')){var marker=document.createElement('span');marker.className='qmx-option-letter';marker.setAttribute('aria-hidden','true');marker.textContent=String.fromCharCode(65+index);btn.insertBefore(marker,btn.firstChild)}
      });
    });
  }
  function install(){
    var data=window.__quizmotoData||{};
    installPresentation(data);
    var answered=Object.create(null),hits=0,totalQuestions=Math.max(1,(data.quiz||[]).length);
    document.querySelectorAll('.quiz-option').forEach(function(btn){
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
        }
        if (!html.includes('quizmoto-scorm-interaction-tracking')) {
            html = html.replace('</body>', `${interactionTrackingScript()}\n</body>`);
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
                assessmentExperienceVersion: 5,
                interactionTracking: 'scorm_1_2_cmi_interactions',
                interactionPersistence: 'background_batched',
                provisionalScoreTracking: true
            }, null, 2));
        } catch (_) {
            // Keep package usable if metadata cannot be upgraded.
        }
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    interactionTrackingScript,
    assessmentExperienceCss
};
