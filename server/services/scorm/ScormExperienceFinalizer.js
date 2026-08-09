const JSZip = require('jszip');
const { buildScormPackageZip: buildExperiencePackage } = require('./ScormExperiencePackageBuilder');

function interactionTrackingScript() {
    return `
<script id="quizmoto-scorm-interaction-tracking">
(function(){
  function install(){
    var data=window.__quizmotoData||{};
    var answered=Object.create(null),hits=0,totalQuestions=Math.max(1,(data.quiz||[]).length);
    document.querySelectorAll('.quiz-option').forEach(function(btn){
      btn.addEventListener('click',function(){
        var qi=Number(btn.getAttribute('data-qi'));
        var oi=Number(btn.getAttribute('data-oi'));
        var q=(data.quiz||[])[qi]||{};
        var correct=Number(q.correctAnswer);

        // Let the browser paint the selected/correct-answer feedback first. The
        // interaction values remain SCORM-tracked, while Quizmoto's player runtime
        // batches persistence in the background.
        setTimeout(function(){
          try{
            if(typeof doLMSSetValue==='function'){
              var base='cmi.interactions.'+qi;
              doLMSSetValue(base+'.id','quiz_'+(qi+1));
              doLMSSetValue(base+'.type','choice');
              doLMSSetValue(base+'.student_response',String(oi));
              doLMSSetValue(base+'.result',oi===correct?'correct':'wrong');
              try{doLMSSetValue(base+'.correct_responses.0.pattern',String(correct))}catch(e){}

              // Admin QA should see score evolve while testing, not only after
              // Finish Course. Use the same final-score denominator (all quiz
              // questions), so the provisional value converges to the final score.
              if(!answered[qi]){
                answered[qi]=true;
                if(oi===correct)hits++;
              }
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
            if(fb){
              var prefix=oi===correct?'Correct. ':'Review this. ';
              fb.textContent=prefix+String(q.explanation);
            }
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
        if (!html.includes('quizmoto-scorm-interaction-tracking')) {
            html = html.replace('</body>', `${interactionTrackingScript()}\n</body>`);
            zip.file('index.html', html);
        }
    }
    const contentFile = zip.file('content.json');
    if (contentFile) {
        try {
            const content = JSON.parse(await contentFile.async('string'));
            zip.file('content.json', JSON.stringify({
                ...content,
                version: 6,
                interactionTracking: 'scorm_1_2_cmi_interactions',
                interactionPersistence: 'background_batched',
                provisionalScoreTracking: true
            }, null, 2));
        } catch (_) {
            // Keep package usable if metadata cannot be upgraded.
        }
    }

    // This ZIP is an intermediate pipeline artifact. The tracking finalizer does
    // the single DEFLATE pass for the user-facing package.
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    interactionTrackingScript
};
