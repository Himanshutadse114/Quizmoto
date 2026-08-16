const JSZip = require('jszip');
const { buildScormPackageZip: buildTrackedPackage } = require('./ScormGammaLayoutFinalizer');

const ANSWER_TRACKING_SCRIPT = `
<script id="scorm-ai-answer-reporting-v1">
(function(){
  function value(v){return v==null?'':String(v)}
  function set(key,v){try{if(typeof doLMSSetValue==='function')return doLMSSetValue(key,value(v))}catch(e){}return 'false'}
  function commit(){try{if(typeof doLMSCommit==='function')doLMSCommit()}catch(e){}}
  function record(btn){
    try{
      var data=window.__quizmotoData||null;
      if(!data||!Array.isArray(data.quiz))return;
      var qi=Number(btn.getAttribute('data-qi')),oi=Number(btn.getAttribute('data-oi'));
      if(!Number.isInteger(qi)||qi<0||!Number.isInteger(oi)||oi<0)return;
      var q=data.quiz[qi]||{},options=Array.isArray(q.options)?q.options:[],correct=Number(q.correctAnswer);
      var selected=options[oi]==null?'':String(options[oi]);
      var correctText=Number.isInteger(correct)&&options[correct]!=null?String(options[correct]):'';
      var result=oi===correct?'correct':'incorrect',prefix='quizmoto.quiz.'+qi+'.';

      set('quizmoto.quiz.count',String(data.quiz.length));
      set(prefix+'question',q.question||'');
      set(prefix+'selected',selected);
      set(prefix+'correct',correctText);
      set(prefix+'selected_index',String(oi));
      set(prefix+'correct_index',Number.isInteger(correct)?String(correct):'');
      set(prefix+'result',result);
      set(prefix+'explanation',q.explanation||'');

      set('cmi.interactions.'+qi+'.id','scorm_ai_question_'+(qi+1));
      set('cmi.interactions.'+qi+'.type','choice');
      set('cmi.interactions.'+qi+'.student_response',String(oi));
      set('cmi.interactions.'+qi+'.learner_response',String(oi));
      set('cmi.interactions.'+qi+'.correct_responses.0.pattern',Number.isInteger(correct)?String(correct):'');
      set('cmi.interactions.'+qi+'.result',oi===correct?'correct':'wrong');
      commit();
    }catch(e){}
  }
  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('.quiz-option[data-qi][data-oi]'):null;
    if(target)record(target);
  },false);
})();
</script>`;

function injectAnswerTracking(html) {
    const source = String(html || '');
    if (source.includes('scorm-ai-answer-reporting-v1')) return source;
    return source.includes('</body>')
        ? source.replace('</body>', `${ANSWER_TRACKING_SCRIPT}\n</body>`)
        : `${source}\n${ANSWER_TRACKING_SCRIPT}`;
}

async function buildScormPackageZip(analysis, opts = {}) {
    const baseBuffer = await buildTrackedPackage(analysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);
    const indexFile = zip.file('index.html');
    if (indexFile) {
        const html = await indexFile.async('string');
        zip.file('index.html', injectAnswerTracking(html));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    injectAnswerTracking,
    ANSWER_TRACKING_SCRIPT
};
