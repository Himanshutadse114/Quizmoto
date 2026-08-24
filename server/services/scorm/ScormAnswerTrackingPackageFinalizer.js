const JSZip = require('jszip');
const { buildScormPackageZip: buildTrackedPackage } = require('./ScormGammaEditorialFinalizer');

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

const FINAL_VISUAL_POLISH_CSS = `
<style id="quizmoto-final-authored-visual-polish-v1">
/* Final learner-course guard. This is injected after every theme layer so the
   authored cover and generated SVGs have one predictable presentation. */
.qmx-runtime-picture{display:block!important;width:100%!important;height:100%!important;min-width:0!important}
.qmx-runtime-picture img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:inherit!important}
.hero-art,.spot-visual{overflow:hidden!important}
.qmx-hub-art{height:360px!important;min-height:320px!important;border-radius:24px!important;overflow:hidden!important;background:rgba(255,255,255,.26)!important;border:1px solid var(--gamma-paper-3,#CBC5B8)!important}
.qmx-hub-art .qmx-runtime-picture,.qmx-hub-art img{width:100%!important;height:100%!important}
/* If a Smart SVG is unavailable for a legacy package, do not draw connector
   lines through the centre label. The numbered nodes + list remain readable. */
.hub-svg line{display:none!important}

.slide.qmx-cover-slide .hero{
  display:grid!important;
  grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr)!important;
  gap:38px!important;
  align-items:center!important;
  padding:32px 34px!important;
}
.slide.qmx-cover-slide .title{
  font-size:40px!important;
  line-height:1.06!important;
  letter-spacing:-.035em!important;
  margin:9px 0 16px!important;
  max-width:700px!important;
}
.slide.qmx-cover-slide .lead{
  font-size:15px!important;
  line-height:1.58!important;
  max-width:690px!important;
  margin:0!important;
}
.slide.qmx-cover-slide .hero-art{
  min-height:330px!important;
  height:330px!important;
  border-radius:24px!important;
  background:#E5DFD2!important;
}
.slide.qmx-cover-slide .kp-row{margin-top:18px!important;gap:8px!important}
.slide.qmx-cover-slide .chip{font-size:10.5px!important;padding:7px 10px!important}

@media(max-width:980px){
  .slide.qmx-cover-slide .hero{grid-template-columns:1fr!important;gap:22px!important;padding:26px!important}
  .slide.qmx-cover-slide .title{font-size:34px!important;max-width:none!important}
  .slide.qmx-cover-slide .lead{font-size:14.5px!important;max-width:none!important}
  .slide.qmx-cover-slide .hero-art{height:280px!important;min-height:280px!important}
  .qmx-hub-art{height:300px!important;min-height:280px!important}
}
@media(max-width:560px){
  .slide.qmx-cover-slide .hero{padding:18px!important;gap:18px!important}
  .slide.qmx-cover-slide .title{font-size:29px!important;line-height:1.08!important;margin-bottom:12px!important}
  .slide.qmx-cover-slide .lead{font-size:14px!important;line-height:1.5!important}
  .slide.qmx-cover-slide .hero-art{height:240px!important;min-height:240px!important;border-radius:18px!important}
  .qmx-hub-art{height:260px!important;min-height:240px!important;border-radius:18px!important}
}
</style>`;

function injectAnswerTracking(html) {
    const source = String(html || '');
    if (source.includes('scorm-ai-answer-reporting-v1')) return source;
    return source.includes('</body>')
        ? source.replace('</body>', `${ANSWER_TRACKING_SCRIPT}\n</body>`)
        : `${source}\n${ANSWER_TRACKING_SCRIPT}`;
}

function exposeAuthorData(html) {
    const source = String(html || '');
    if (source.includes('window.__quizmotoData=')) return source;
    return source.replace(/\bvar\s+data\s*=\s*/, 'var data=window.__quizmotoData=');
}

function svgDataUri(svg) {
    return `data:image/svg+xml;base64,${Buffer.from(String(svg || ''), 'utf8').toString('base64')}`;
}

async function buildEmbeddedVisualMap(zip) {
    const result = {};
    const names = Object.keys(zip.files).filter((name) => /^assets\/visuals\/.*\.svg$/i.test(name) && !zip.files[name].dir);
    for (const name of names) {
        const svg = await zip.file(name).async('string');
        result[name] = svgDataUri(svg);
    }
    return result;
}

function finalVisualPolishScript(visualMap = {}) {
    const safeMap = JSON.stringify(visualMap).replace(/</g, '\\u003c');
    return `
<script id="quizmoto-final-authored-visual-polish-script-v1">
(function(){
  if(window.__quizmotoFinalVisualPolishV1)return;
  window.__quizmotoFinalVisualPolishV1=true;
  var VISUALS=${safeMap};

  function esc(s){var M={'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'};return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c})}
  function src(path){path=String(path||'');return VISUALS[path]||path}
  function picture(desktop,mobile,alt){
    desktop=src(desktop);mobile=src(mobile);
    if(!desktop)return '';
    return '<picture class="qmx-runtime-picture">'+(mobile?'<source media="(max-width:680px)" srcset="'+esc(mobile)+'">':'')+'<img src="'+esc(desktop)+'" alt="'+esc(alt||'Learning visual')+'" decoding="async"></picture>';
  }
  function compactSummary(text,maxWords){
    var words=String(text||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
    if(words.length<=maxWords)return words.join(' ');
    return words.slice(0,maxWords).join(' ').replace(/[,:;\-]+$/,'')+'…';
  }
  function replaceVisual(node,html){
    if(!node||!html)return false;
    node.innerHTML=html;
    node.setAttribute('data-qmx-runtime-visual','1');
    return true;
  }
  function enhance(){
    var data=window.__quizmotoData||null;
    if(!data||!Array.isArray(data.slides))return false;
    var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));
    if(!slides.length)return false;

    var intro=slides[0];
    if(intro){
      intro.classList.add('qmx-cover-slide');
      var lead=intro.querySelector('.lead');
      if(lead&&data.summary)lead.textContent=compactSummary(data.summary,72);
      var cover=picture(data.coverVisualAsset,data.coverMobileVisualAsset,data.title||'Course cover');
      if(!cover&&data.slides[0])cover=picture(data.slides[0].visualAsset,data.slides[0].mobileVisualAsset,data.title||'Course cover');
      var coverTarget=intro.querySelector('.hero-art')||intro.querySelector('.hero-core');
      replaceVisual(coverTarget,cover);
    }

    data.slides.forEach(function(s,i){
      var node=slides[i+1];if(!node)return;
      var html=picture(s.visualAsset,s.mobileVisualAsset,s.visualTitle||s.title||'Learning visual');
      if(!html)return;
      var layout=String(s.layout||'').toLowerCase();
      if(layout==='hub'){
        var existing=node.querySelector('.qmx-hub-art');
        if(existing){replaceVisual(existing,html);return;}
        var hub=node.querySelector('.hub-svg');
        if(hub&&hub.parentNode){
          var art=document.createElement('div');
          art.className='qmx-hub-art';
          art.innerHTML=html;
          art.setAttribute('data-qmx-runtime-visual','1');
          hub.parentNode.replaceChild(art,hub);
          return;
        }
      }
      var target=node.querySelector('.spot-visual')||node.querySelector('.hero-art')||node.querySelector('.hero-core');
      replaceVisual(target,html);
    });
    return true;
  }

  function run(){
    if(enhance())return;
    setTimeout(enhance,80);
    setTimeout(enhance,350);
    setTimeout(enhance,900);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('load',function(){setTimeout(enhance,0)},{once:true});
})();
</script>`;
}

function injectFinalVisualPolish(html, visualMap) {
    let source = exposeAuthorData(html);
    if (!source.includes('quizmoto-final-authored-visual-polish-v1')) {
        source = source.includes('</head>')
            ? source.replace('</head>', `${FINAL_VISUAL_POLISH_CSS}\n</head>`)
            : `${FINAL_VISUAL_POLISH_CSS}\n${source}`;
    }
    if (!source.includes('quizmoto-final-authored-visual-polish-script-v1')) {
        const script = finalVisualPolishScript(visualMap);
        source = source.includes('</body>') ? source.replace('</body>', `${script}\n</body>`) : `${source}\n${script}`;
    }
    return source;
}

async function buildScormPackageZip(analysis, opts = {}) {
    const baseBuffer = await buildTrackedPackage(analysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);
    const visualMap = await buildEmbeddedVisualMap(zip);
    const indexFile = zip.file('index.html');
    if (indexFile) {
        const html = await indexFile.async('string');
        const withTracking = injectAnswerTracking(html);
        zip.file('index.html', injectFinalVisualPolish(withTracking, visualMap));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
    buildScormPackageZip,
    injectAnswerTracking,
    injectFinalVisualPolish,
    finalVisualPolishScript,
    buildEmbeddedVisualMap,
    exposeAuthorData,
    FINAL_VISUAL_POLISH_CSS,
    ANSWER_TRACKING_SCRIPT
};
