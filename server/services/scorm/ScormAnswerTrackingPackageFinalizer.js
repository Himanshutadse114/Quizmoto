const JSZip = require('jszip');
const { buildScormPackageZip: buildTrackedPackage } = require('./ScormTrackingPackageFinalizer');

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

const LAPTOP_EXPERIENCE_CSS = `
<style id="scorm-ai-laptop-experience-v1">
.qmx-reveal-attention{animation:qmxRevealAttention .72s cubic-bezier(.2,.8,.2,1)}
@keyframes qmxRevealAttention{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 42%,transparent)}45%{box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}100%{box-shadow:0 0 0 0 transparent}}

@media (min-width:821px) and (max-height:920px){
  header{height:56px!important;min-height:56px!important;padding:0 18px!important}
  footer{height:60px!important;min-height:60px!important;padding:0 20px!important}
  .brand-mark{width:34px!important;height:34px!important;border-radius:11px!important}
  .slide{padding:14px 22px 18px!important;scroll-padding-top:14px;scroll-padding-bottom:88px}
  .slide.active{align-items:flex-start!important;justify-content:flex-start!important}
  .qmx-stage{width:min(1160px,100%)!important;margin:auto!important}
  .qmx-frame,.qmx-type-takeaway .qmx-frame{grid-template-columns:minmax(270px,.78fr) minmax(460px,1.22fr)!important;gap:12px 18px!important;align-items:start!important}
  .qmx-copy{padding:18px 20px 16px!important;align-self:start!important}
  .qmx-copy h2{font-size:clamp(28px,2.45vw,38px)!important;line-height:1.03!important;margin:0 0 10px!important;letter-spacing:-.04em!important}
  .qmx-copy p{font-size:14px!important;line-height:1.5!important}
  .qmx-kicker{margin-bottom:7px!important;font-size:9.5px!important}
  .qmx-visual,.qmx-type-takeaway .qmx-visual,.qmx-type-hotspot .qmx-visual,.qmx-type-scenario .qmx-visual{min-height:360px!important;border-radius:22px!important}
  .qmx-visual img{max-height:390px!important;max-width:100%!important;object-fit:contain!important}
  .qmx-visual-label{left:12px!important;bottom:10px!important;padding:5px 8px!important;font-size:8px!important}
  .qmx-interaction{padding:0 3px 4px!important}
  .qmx-prompt{font-size:11.5px!important;line-height:1.35!important;margin:0 0 8px!important}
  .qmx-points{gap:7px!important}
  .qmx-point{min-height:40px!important;padding:8px 10px!important;border-radius:11px!important;font-size:11.5px!important}
  .qmx-point-index{width:19px!important;height:19px!important;border-radius:6px!important;margin-right:6px!important;font-size:8.5px!important}
  .qmx-count{font-size:9.5px!important;margin-top:7px!important}
  .qmx-reveal{margin-top:8px!important;padding:11px 13px!important;border-radius:13px!important;font-size:12.5px!important;line-height:1.45!important;min-height:48px!important;overflow-wrap:anywhere}
  .qmx-reveal-label{font-size:8.5px!important;margin-bottom:4px!important}
}

@media (min-width:821px) and (max-height:760px){
  header{height:52px!important;min-height:52px!important}
  footer{height:56px!important;min-height:56px!important}
  .slide{padding:10px 18px 14px!important;scroll-padding-bottom:78px}
  .qmx-frame,.qmx-type-takeaway .qmx-frame{grid-template-columns:minmax(260px,.8fr) minmax(430px,1.2fr)!important;gap:10px 15px!important}
  .qmx-copy{padding:15px 17px 13px!important}
  .qmx-copy h2{font-size:clamp(25px,2.25vw,33px)!important;margin-bottom:7px!important}
  .qmx-copy p{font-size:13px!important;line-height:1.42!important}
  .qmx-visual,.qmx-type-takeaway .qmx-visual,.qmx-type-hotspot .qmx-visual,.qmx-type-scenario .qmx-visual{min-height:320px!important}
  .qmx-visual img{max-height:345px!important}
  .qmx-point{min-height:36px!important;padding:7px 9px!important;font-size:11px!important}
  .qmx-reveal{font-size:12px!important;line-height:1.4!important;padding:9px 11px!important}
}

@media(prefers-reduced-motion:reduce){.qmx-reveal-attention{animation:none!important}}
</style>`;

const LAPTOP_EXPERIENCE_SCRIPT = `
<script id="scorm-ai-laptop-experience-script-v1">
(function(){
  var laptopQuery='(min-width:821px) and (max-height:920px)';
  function reducedMotion(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}}
  function updateLaptopClass(){try{document.documentElement.classList.toggle('qmx-laptop',window.matchMedia(laptopQuery).matches)}catch(e){}}
  function resetActiveSlideScroll(){
    var active=document.querySelector('.slide.active');
    if(!active)return;
    try{active.scrollTo({top:0,left:0,behavior:'auto'})}catch(e){active.scrollTop=0;active.scrollLeft=0}
  }
  function revealIntoView(button){
    if(!button||!button.closest)return;
    var frame=button.closest('.qmx-frame');
    var reveal=frame&&frame.querySelector('[data-reveal]');
    if(!reveal||reveal.hidden)return;
    reveal.classList.remove('qmx-reveal-attention');
    try{void reveal.offsetWidth}catch(e){}
    reveal.classList.add('qmx-reveal-attention');
    setTimeout(function(){try{reveal.classList.remove('qmx-reveal-attention')}catch(e){}},760);
    var slide=button.closest('.slide');
    if(!slide)return;
    requestAnimationFrame(function(){
      var sr=slide.getBoundingClientRect(),rr=reveal.getBoundingClientRect();
      var outside=rr.bottom>sr.bottom-14||rr.top<sr.top+12;
      if(!outside)return;
      try{reveal.scrollIntoView({behavior:reducedMotion()?'auto':'smooth',block:'nearest',inline:'nearest'})}
      catch(e){slide.scrollTop=Math.max(0,slide.scrollTop+(rr.bottom-sr.bottom)+20)}
    });
  }
  function observeSlides(){
    if(typeof MutationObserver!=='function')return;
    document.querySelectorAll('.slide').forEach(function(slide){
      var observer=new MutationObserver(function(records){
        records.forEach(function(record){
          if(record.attributeName==='class'&&slide.classList.contains('active'))resetActiveSlideScroll();
        });
      });
      observer.observe(slide,{attributes:true,attributeFilter:['class']});
    });
  }
  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('.qmx-point'):null;
    if(target)setTimeout(function(){revealIntoView(target)},35);
    var nav=event.target&&event.target.closest?event.target.closest('.nav-btn'):null;
    if(nav)setTimeout(resetActiveSlideScroll,35);
  },false);
  updateLaptopClass();
  window.addEventListener('resize',updateLaptopClass,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeSlides,{once:true});else observeSlides();
})();
</script>`;

function injectAnswerTracking(html) {
    let source = String(html || '');
    if (!source.includes('scorm-ai-answer-reporting-v1')) {
        source = source.includes('</body>')
            ? source.replace('</body>', `${ANSWER_TRACKING_SCRIPT}\n</body>`)
            : `${source}\n${ANSWER_TRACKING_SCRIPT}`;
    }
    if (!source.includes('scorm-ai-laptop-experience-v1')) {
        source = source.includes('</body>')
            ? source.replace('</body>', `${LAPTOP_EXPERIENCE_CSS}\n${LAPTOP_EXPERIENCE_SCRIPT}\n</body>`)
            : `${source}\n${LAPTOP_EXPERIENCE_CSS}\n${LAPTOP_EXPERIENCE_SCRIPT}`;
    }
    return source;
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
    ANSWER_TRACKING_SCRIPT,
    LAPTOP_EXPERIENCE_CSS,
    LAPTOP_EXPERIENCE_SCRIPT
};
