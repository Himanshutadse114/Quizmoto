const JSZip = require('jszip');
const { buildScormPackageZip: buildExperiencePackage } = require('./ScormExperiencePackageBuilder');

function interactionTrackingScript() {
    return `
<script id="quizmoto-scorm-interaction-tracking">
(function(){
  function install(){
    var data=window.__quizmotoData||{};
    document.querySelectorAll('.quiz-option').forEach(function(btn){
      btn.addEventListener('click',function(){
        var qi=Number(btn.getAttribute('data-qi'));
        var oi=Number(btn.getAttribute('data-oi'));
        var q=(data.quiz||[])[qi]||{};
        var correct=Number(q.correctAnswer);
        try{
          if(typeof doLMSSetValue==='function'){
            var base='cmi.interactions.'+qi;
            doLMSSetValue(base+'.id','quiz_'+(qi+1));
            doLMSSetValue(base+'.type','choice');
            doLMSSetValue(base+'.student_response',String(oi));
            doLMSSetValue(base+'.result',oi===correct?'correct':'wrong');
            try{doLMSSetValue(base+'.correct_responses.0.pattern',String(correct))}catch(e){}
            if(typeof doLMSCommit==='function')doLMSCommit();
          }
        }catch(e){}
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
                version: 4,
                interactionTracking: 'scorm_1_2_cmi_interactions'
            }, null, 2));
        } catch (_) {
            // Keep package usable if metadata cannot be upgraded.
        }
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
    buildScormPackageZip
};
