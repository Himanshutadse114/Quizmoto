const express = require('express');
const router = express.Router();
const { getObjectStorage } = require('../../storage/ObjectStorage');
const { packageContentKey } = require('../../services/scorm/storageKeys');
const { ScormPackage, ScormRegistration, ScormCourse } = require('../../models/scorm');
const jwt = require('jsonwebtoken');
const { guessContentType } = require('../../services/scorm/ScormUnpackService');
const {
    patchTrackingRuntime,
    patchMobileCourse
} = require('../../services/scorm/ScormTrackingPackageFinalizer');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function resolvePackageAccess(accessToken, packageIdHint) {
    if (!accessToken) return null;
    let decoded;
    try {
        decoded = jwt.verify(accessToken, JWT_SECRET);
    } catch (_) {
        return null;
    }

    if (decoded.typ === 'scorm_reg' && decoded.scormRegId) {
        const reg = await ScormRegistration.findByPk(decoded.scormRegId, {
            include: [{ model: ScormCourse, as: 'course' }]
        });
        if (!reg || reg.status === 'revoked' || !reg.course) return null;
        return {
            packageId: reg.course.packageId,
            registrationId: reg.id,
            isPreview: Boolean(reg.isPreview)
        };
    }

    if (decoded.userId && packageIdHint) {
        const pkg = await ScormPackage.findOne({ where: { id: packageIdHint, hostId: decoded.userId } });
        if (!pkg) return null;
        return { packageId: pkg.id, registrationId: null, isPreview: false };
    }

    return null;
}

function authoredRuntimeBridge() {
    return `
<script id="quizmoto-authored-runtime-bridge-v7">
(function(){
  if(window.__quizmotoAuthoredBridgeV7)return;
  window.__quizmotoAuthoredBridgeV7=true;

  var answered=Object.create(null),hits=0;

  function state(){
    var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));
    if(!slides.length)return null;
    var active=document.querySelector('.slide.active');
    var index=Math.max(0,slides.indexOf(active));
    var progress=Math.round(index/Math.max(1,slides.length-1)*100);
    return {index:index,progress:progress,total:slides.length};
  }

  function quizTotal(){
    try{
      var data=window.__quizmotoData||{};
      if(Array.isArray(data.quiz)&&data.quiz.length)return data.quiz.length;
    }catch(e){}
    var max=-1;
    document.querySelectorAll('.quiz-option[data-qi]').forEach(function(btn){
      var qi=Number(btn.getAttribute('data-qi'));
      if(Number.isFinite(qi)&&qi>max)max=qi;
    });
    return Math.max(1,max+1);
  }

  function mergedSuspendState(s){
    var resume={};
    try{
      if(typeof doLMSGetValue==='function'){
        var raw=doLMSGetValue('cmi.suspend_data');
        if(raw){
          var parsed=JSON.parse(raw);
          if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))resume=parsed;
        }
      }
    }catch(e){}
    resume.quizmotoSlide=s.index;
    resume.quizmotoProgress=s.progress;
    return resume;
  }

  function persistProgress(){
    if(typeof doLMSSetValue!=='function')return;
    var s=state();if(!s)return;
    try{
      doLMSSetValue('cmi.core.lesson_location',String(s.index));
      doLMSSetValue('cmi.suspend_data',JSON.stringify(mergedSuspendState(s)));
      doLMSSetValue('cmi.core.lesson_status','incomplete');
      if(typeof doLMSCommit==='function')doLMSCommit();
    }catch(e){}
  }

  function persistAnswer(btn){
    if(typeof doLMSSetValue!=='function'||!btn)return;
    var qi=Number(btn.getAttribute('data-qi'));
    var oi=Number(btn.getAttribute('data-oi'));
    if(!Number.isFinite(qi)||!Number.isFinite(oi))return;
    var data=window.__quizmotoData||{};
    var q=(data.quiz||[])[qi]||{};
    var correct=Number(q.correctAnswer);
    try{
      var base='cmi.interactions.'+qi;
      doLMSSetValue(base+'.id','quiz_'+(qi+1));
      doLMSSetValue(base+'.type','choice');
      doLMSSetValue(base+'.student_response',String(oi));
      if(Number.isFinite(correct)){
        doLMSSetValue(base+'.result',oi===correct?'correct':'wrong');
        try{doLMSSetValue(base+'.correct_responses.0.pattern',String(correct))}catch(e){}
        if(!answered[qi]){
          answered[qi]=true;
          if(oi===correct)hits++;
        }
        var provisional=Math.round((hits/quizTotal())*100);
        doLMSSetValue('cmi.core.score.min','0');
        doLMSSetValue('cmi.core.score.max','100');
        doLMSSetValue('cmi.core.score.raw',String(provisional));
      }
      persistProgress();
    }catch(e){}
  }

  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('button'):null;
    if(!target)return;
    if(target.matches('.quiz-option')){
      setTimeout(function(){persistAnswer(target)},60);
      return;
    }
    if(target.id==='next-btn'||target.id==='prev-btn'){
      setTimeout(persistProgress,80);
    }
  },true);

  if(document.readyState==='complete')setTimeout(persistProgress,300);
  else window.addEventListener('load',function(){setTimeout(persistProgress,300)});
})();
</script>`;
}

function universalRuntimeProgressBridge() {
    return `
<script id="quizmoto-runtime-progress-bridge-v1">
(function(){
  if(window.__quizmotoRuntimeProgressBridgeV1)return;
  window.__quizmotoRuntimeProgressBridgeV1=true;

  var lastSignature='',timer=null;

  function findRuntime(){
    try{
      if(window.parent&&window.parent!==window){
        if(window.parent.API_1484_11)return {kind:'2004',api:window.parent.API_1484_11};
        if(window.parent.API)return {kind:'12',api:window.parent.API};
      }
    }catch(e){}
    try{
      if(window.API_1484_11)return {kind:'2004',api:window.API_1484_11};
      if(window.API)return {kind:'12',api:window.API};
    }catch(e){}
    return null;
  }

  function setValue(rt,key,value){
    try{
      if(rt.kind==='2004')return rt.api.SetValue(key,String(value));
      return rt.api.LMSSetValue(key,String(value));
    }catch(e){return 'false'}
  }

  function commit(rt){
    try{
      if(rt.kind==='2004')return rt.api.Commit('');
      return rt.api.LMSCommit('');
    }catch(e){return 'false'}
  }

  function clamp(value){
    var n=Number(value);
    if(!Number.isFinite(n))return null;
    return Math.max(0,Math.min(100,Math.round(n*10)/10));
  }

  function percentFromText(text){
    var m=String(text||'').match(/(^|\s)(\d{1,3}(?:\.\d+)?)\s*%/);
    return m?clamp(m[2]):null;
  }

  function inspect(){
    var slides=Array.prototype.slice.call(document.querySelectorAll('.slide'));
    if(slides.length>1){
      var active=document.querySelector('.slide.active');
      var index=slides.indexOf(active);
      if(index<0)index=0;
      return {progress:clamp(index/Math.max(1,slides.length-1)*100),location:String(index),source:'slides'};
    }

    var progressEl=document.querySelector('progress');
    if(progressEl){
      var max=Number(progressEl.max||100),value=Number(progressEl.value);
      if(Number.isFinite(max)&&max>0&&Number.isFinite(value)){
        return {progress:clamp(value/max*100),location:null,source:'progress'};
      }
    }

    var aria=document.querySelector('[role="progressbar"][aria-valuenow]');
    if(aria){
      var now=Number(aria.getAttribute('aria-valuenow'));
      var min=Number(aria.getAttribute('aria-valuemin')||0);
      var maxAria=Number(aria.getAttribute('aria-valuemax')||100);
      if(Number.isFinite(now)&&Number.isFinite(min)&&Number.isFinite(maxAria)&&maxAria>min){
        return {progress:clamp((now-min)/(maxAria-min)*100),location:null,source:'aria'};
      }
    }

    var candidates=document.querySelectorAll('#progress-text,.progress-text,[data-progress],[class*="progress-percent"],[id*="progress-percent"]');
    for(var i=0;i<candidates.length;i++){
      var p=percentFromText(candidates[i].textContent);
      if(p!=null)return {progress:p,location:null,source:'text'};
    }
    return null;
  }

  function persist(){
    var state=inspect();
    if(!state||state.progress==null)return;
    var rt=findRuntime();
    if(!rt)return;
    var signature=state.progress+'|'+(state.location||'');
    if(signature===lastSignature)return;

    var ok=setValue(rt,'quizmoto.progress_percent',state.progress);
    if(ok==='false')return;
    if(state.location!=null){
      setValue(rt,'cmi.core.lesson_location',state.location);
      setValue(rt,'cmi.location',state.location);
    }
    if(state.progress>0&&state.progress<100){
      setValue(rt,'cmi.core.lesson_status','incomplete');
      setValue(rt,'cmi.completion_status','incomplete');
    }
    commit(rt);
    lastSignature=signature;
  }

  function queue(){
    if(timer)clearTimeout(timer);
    timer=setTimeout(function(){timer=null;persist()},120);
  }

  document.addEventListener('click',queue,true);
  document.addEventListener('keyup',queue,true);
  window.addEventListener('hashchange',queue);
  window.addEventListener('popstate',queue);
  if(document.readyState==='complete')setTimeout(persist,350);
  else window.addEventListener('load',function(){setTimeout(persist,350)});

  try{
    var observer=new MutationObserver(queue);
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-valuenow','value']});
  }catch(e){}

  setInterval(persist,1500);
})();
</script>`;
}

function patchLegacyCourseInteractionRuntime(source) {
    let patched = String(source || '');

    // The first flip-card release watched every class mutation under <main> and
    // then rewrote the same grid classes from inside that observer. On authored
    // courses this can create an observer feedback loop during render(), pinning
    // the browser main thread, preventing image requests from painting and making
    // navigation appear dead. Patch already-stored packages at serve time so they
    // do not need a rebuild just to recover from that runtime bug.
    patched = patched.replace(
        "grid.classList.add('qmx-flip-grid');",
        "if (!grid.classList.contains('qmx-flip-grid')) grid.classList.add('qmx-flip-grid');"
    );

    const legacyObserver = `    var main = document.querySelector('main');
    if (main && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function(){
        upgradeCards();
        syncNextGate();
      });
      observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    }`;

    const eventDrivenSync = `    function syncAfterNavigation(event){
      var nav = event.target && event.target.closest ? event.target.closest('#next-btn,#prev-btn') : null;
      if (!nav) return;
      setTimeout(syncNextGate, 0);
    }
    document.addEventListener('click', syncAfterNavigation, false);
    window.addEventListener('load', function(){ setTimeout(syncNextGate, 0); });`;

    if (patched.includes(legacyObserver)) {
        patched = patched.replace(legacyObserver, eventDrivenSync);
    }

    return patched;
}

function patchAuthoredHtml(source) {
    let patched = String(source || '');

    // patchTrackingRuntime is deliberately idempotent so stored v4/v5 modules can
    // receive newer resume/tracking fixes without duplicating injected helpers.
    patched = patchTrackingRuntime(patched);
    patched = patchLegacyCourseInteractionRuntime(patched);

    // Older interaction tracking committed synchronously inside the answer click
    // handler. Quizmoto's parent player now batches authored writes asynchronously.
    patched = patched.replace(
        "if(typeof doLMSCommit==='function')doLMSCommit();",
        ''
    );

    // Existing packages in object storage must gain current tracking behaviour
    // without regeneration. This DOM-level bridge is independent of the exact
    // generated-course script version and provides location/progress/interaction
    // and provisional-score writes for old and new authored modules.
    if (!patched.includes('quizmoto-authored-runtime-bridge-v7')) {
        if (patched.includes('</body>')) patched = patched.replace('</body>', `${authoredRuntimeBridge()}\n</body>`);
        else patched += authoredRuntimeBridge();
    }

    return patchMobileCourse(patched);
}

function injectUniversalProgressBridge(source) {
    let patched = String(source || '');
    if (patched.includes('quizmoto-runtime-progress-bridge-v1')) return patched;
    if (patched.includes('</body>')) return patched.replace('</body>', `${universalRuntimeProgressBridge()}\n</body>`);
    return patched + universalRuntimeProgressBridge();
}

async function patchHtmlIfNeeded(packageId, rel, buf) {
    if (!/\.html?$/i.test(String(rel || ''))) return { buffer: buf, patched: false };

    const pkg = await ScormPackage.findByPk(packageId, { attributes: ['id', 'source'] });
    if (!pkg) return { buffer: buf, patched: false };

    const source = buf.toString('utf8');
    let patched = source;

    if (pkg.source === 'ai_author') {
        // Quizmoto-authored courses already have an exact slide-aware tracking
        // bridge. Do not add the generic whole-document MutationObserver as well;
        // it is redundant and needlessly expensive on visual/interactive slides.
        patched = patchAuthoredHtml(patched);
    } else {
        // Third-party packages do not have the authored bridge, so retain the
        // generic progress detector for them only.
        patched = injectUniversalProgressBridge(patched);
    }

    if (patched === source) return { buffer: buf, patched: false };
    return { buffer: Buffer.from(patched, 'utf8'), patched: true };
}

async function sendContent(res, packageId, rel, { allowPreviewEmbed = false } = {}) {
    const key = packageContentKey(packageId, rel);
    const storage = getObjectStorage();
    const buf = await storage.getObjectBuffer(key);
    const served = await patchHtmlIfNeeded(packageId, rel, buf);

    res.setHeader('Content-Type', guessContentType(rel));
    res.setHeader('Cache-Control', served.patched ? 'private, no-store' : 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', allowPreviewEmbed ? "frame-ancestors 'self' https: http:" : "frame-ancestors 'self'");
    res.send(served.buffer);
}

function normalizeRel(pathParam) {
    let rel = pathParam || '';
    if (Array.isArray(rel)) rel = rel.join('/');
    return String(rel).replace(/^\/+/, '');
}

router.get('/t/:accessToken/*path', async (req, res) => {
    try {
        const accessToken = decodeURIComponent(req.params.accessToken || '');
        const rel = normalizeRel(req.params.path);
        const access = await resolvePackageAccess(accessToken, null);
        if (!access) return res.status(401).json({ message: 'Unauthorized' });
        const allowPreviewEmbed = access.isPreview && String(req.query.previewEmbed || '') === '1';
        await sendContent(res, access.packageId, rel, { allowPreviewEmbed });
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

router.get('/:packageId/*path', async (req, res) => {
    try {
        const packageId = req.params.packageId;
        if (packageId === 't') return res.status(404).json({ message: 'Not found' });
        const rel = normalizeRel(req.params.path);
        const auth = (req.header('Authorization') || '').replace(/^Bearer\s+/i, '');
        const token = auth || req.query.token;
        const access = await resolvePackageAccess(token, packageId);
        if (!access || access.packageId !== packageId) return res.status(401).json({ message: 'Unauthorized' });
        const allowPreviewEmbed = access.isPreview && String(req.query.previewEmbed || '') === '1';
        await sendContent(res, packageId, rel, { allowPreviewEmbed });
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

router.patchAuthoredHtml = patchAuthoredHtml;
router.patchLegacyCourseInteractionRuntime = patchLegacyCourseInteractionRuntime;
router.authoredRuntimeBridge = authoredRuntimeBridge;
router.universalRuntimeProgressBridge = universalRuntimeProgressBridge;
module.exports = router;
