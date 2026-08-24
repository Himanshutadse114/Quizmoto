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
/* Final learner-course guard. Generated SVGs remain available on learning
   slides, but the course cover is deliberately text-only. */
.qmx-runtime-picture{display:block!important;width:100%!important;height:100%!important;min-width:0!important}
.qmx-runtime-picture img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:inherit!important}
.hero-art,.spot-visual{overflow:hidden!important}
.qmx-hub-art{height:360px!important;min-height:320px!important;border-radius:24px!important;overflow:hidden!important;background:rgba(255,255,255,.26)!important;border:1px solid var(--gamma-paper-3,#CBC5B8)!important}
.qmx-hub-art .qmx-runtime-picture,.qmx-hub-art img{width:100%!important;height:100%!important}
.hub-svg line{display:none!important}

/* Text-only first impression. No vector/image panel is rendered on the cover. */
.slide.qmx-cover-slide .hero{
  position:relative!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  min-height:560px!important;
  width:min(1120px,100%)!important;
  margin:auto!important;
  padding:64px 72px!important;
  gap:0!important;
  text-align:center!important;
  overflow:hidden!important;
  border:1px solid var(--gamma-paper-3,#CBC5B8)!important;
  border-radius:18px!important;
  background:
    radial-gradient(circle at 50% 0%,rgba(79,201,191,.18),transparent 34%),
    radial-gradient(circle at 8% 88%,rgba(79,201,191,.08),transparent 28%),
    radial-gradient(circle at 92% 82%,rgba(252,242,181,.42),transparent 26%),
    rgba(255,255,255,.20)!important;
  box-shadow:0 18px 54px rgba(40,40,36,.06)!important;
}
.slide.qmx-cover-slide .hero:before,
.slide.qmx-cover-slide .hero:after{
  content:""!important;
  position:absolute!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  width:118px!important;
  height:3px!important;
  border-radius:999px!important;
  background:linear-gradient(90deg,transparent,#4FC9BF,transparent)!important;
  opacity:.95!important;
  display:block!important;
}
.slide.qmx-cover-slide .hero:before{top:34px!important}
.slide.qmx-cover-slide .hero:after{bottom:34px!important}
.slide.qmx-cover-slide .hero-art,
.slide.qmx-cover-slide .hero-core,
.slide.qmx-cover-slide picture,
.slide.qmx-cover-slide svg,
.slide.qmx-cover-slide img{
  display:none!important;
}
.slide.qmx-cover-slide .hero > :not(.hero-art):not(.hero-core){
  width:100%!important;
  max-width:1040px!important;
  margin-left:auto!important;
  margin-right:auto!important;
}
.slide.qmx-cover-slide .eyebrow{
  display:inline-flex!important;
  width:auto!important;
  align-items:center!important;
  justify-content:center!important;
  margin:0 auto 18px!important;
  padding:8px 13px!important;
  border:1px solid rgba(23,126,120,.24)!important;
  border-radius:999px!important;
  color:#177E78!important;
  background:rgba(79,201,191,.09)!important;
  font-size:10px!important;
  font-weight:900!important;
  letter-spacing:.13em!important;
  text-transform:uppercase!important;
}
.slide.qmx-cover-slide .title{
  width:100%!important;
  max-width:980px!important;
  margin:0 auto 24px!important;
  color:var(--gamma-ink,#282824)!important;
  font-size:52px!important;
  line-height:1.04!important;
  letter-spacing:-.045em!important;
  text-align:center!important;
  text-wrap:balance!important;
}
.slide.qmx-cover-slide .lead{
  width:100%!important;
  max-width:790px!important;
  margin:0 auto!important;
  color:var(--gamma-ink-soft,#4A4A45)!important;
  font-size:18px!important;
  line-height:1.62!important;
  text-align:center!important;
  text-wrap:pretty!important;
}
.slide.qmx-cover-slide .kp-row{display:none!important}
.qmx-cover-meta{
  display:flex!important;
  flex-wrap:wrap!important;
  align-items:center!important;
  justify-content:center!important;
  gap:9px!important;
  margin:28px auto 0!important;
  width:auto!important;
  max-width:800px!important;
}
.qmx-cover-meta span{
  display:inline-flex!important;
  align-items:center!important;
  min-height:31px!important;
  padding:6px 11px!important;
  border-radius:999px!important;
  border:1px solid var(--gamma-paper-3,#CBC5B8)!important;
  background:rgba(255,255,255,.32)!important;
  color:var(--gamma-ink-soft,#4A4A45)!important;
  font-size:10.5px!important;
  font-weight:800!important;
  letter-spacing:.035em!important;
}

@media(max-width:980px){
  .slide.qmx-cover-slide .hero{min-height:520px!important;padding:54px 42px!important}
  .slide.qmx-cover-slide .title{font-size:42px!important;max-width:820px!important}
  .slide.qmx-cover-slide .lead{font-size:17px!important;max-width:720px!important}
  .qmx-hub-art{height:300px!important;min-height:280px!important}
}
@media(max-width:560px){
  .slide.qmx-cover-slide .hero{min-height:470px!important;padding:48px 20px!important;border-radius:14px!important}
  .slide.qmx-cover-slide .hero:before{top:24px!important}
  .slide.qmx-cover-slide .hero:after{bottom:24px!important}
  .slide.qmx-cover-slide .eyebrow{margin-bottom:14px!important;font-size:9px!important}
  .slide.qmx-cover-slide .title{font-size:32px!important;line-height:1.07!important;margin-bottom:18px!important}
  .slide.qmx-cover-slide .lead{font-size:15px!important;line-height:1.55!important}
  .qmx-cover-meta{margin-top:22px!important;gap:7px!important}
  .qmx-cover-meta span{font-size:9.5px!important;min-height:29px!important;padding:5px 9px!important}
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
  function addCoverMeta(intro,data){
    if(!intro||intro.querySelector('.qmx-cover-meta'))return;
    var host=intro.querySelector('.hero > div')||intro.querySelector('.hero');
    if(!host)return;
    var meta=document.createElement('div');meta.className='qmx-cover-meta';
    var labels=['Self-paced learning',String((data.slides||[]).length)+' learning sections'];
    if(Array.isArray(data.quiz)&&data.quiz.length)labels.push(String(data.quiz.length)+' knowledge checks');
    labels.forEach(function(label){var item=document.createElement('span');item.textContent=label;meta.appendChild(item);});
    host.appendChild(meta);
  }
  function removeCoverArtwork(intro){
    if(!intro)return;
    var artwork=Array.prototype.slice.call(intro.querySelectorAll('.hero-art,.hero-core'));
    artwork.forEach(function(node){if(node&&node.parentNode)node.parentNode.removeChild(node);});
    intro.querySelectorAll('picture,svg,img').forEach(function(node){if(node&&node.parentNode)node.parentNode.removeChild(node);});
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
      if(lead&&data.summary)lead.textContent=compactSummary(data.summary,58);
      removeCoverArtwork(intro);
      addCoverMeta(intro,data);
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
