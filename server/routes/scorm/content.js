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
        return { packageId: reg.course.packageId, registrationId: reg.id };
    }

    if (decoded.userId && packageIdHint) {
        const pkg = await ScormPackage.findOne({ where: { id: packageIdHint, hostId: decoded.userId } });
        if (!pkg) return null;
        return { packageId: pkg.id, registrationId: null };
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

  function persistProgress(){
    if(typeof doLMSSetValue!=='function')return;
    var s=state();if(!s)return;
    try{
      doLMSSetValue('cmi.core.lesson_location',String(s.index));
      doLMSSetValue('cmi.suspend_data',JSON.stringify({quizmotoSlide:s.index,quizmotoProgress:s.progress}));
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

function patchAuthoredHtml(source) {
    let patched = String(source || '');

    // patchTrackingRuntime is deliberately idempotent so stored v4/v5 modules can
    // receive newer resume/tracking fixes without duplicating injected helpers.
    patched = patchTrackingRuntime(patched);

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

async function patchAiAuthorHtmlIfNeeded(packageId, rel, buf) {
    if (!/\.html?$/i.test(String(rel || ''))) return { buffer: buf, patched: false };

    const pkg = await ScormPackage.findByPk(packageId, { attributes: ['id', 'source'] });
    if (!pkg || pkg.source !== 'ai_author') return { buffer: buf, patched: false };

    const source = buf.toString('utf8');
    const patched = patchAuthoredHtml(source);
    if (patched === source) return { buffer: buf, patched: false };

    return { buffer: Buffer.from(patched, 'utf8'), patched: true };
}

async function sendContent(res, packageId, rel) {
    const key = packageContentKey(packageId, rel);
    const storage = getObjectStorage();
    const buf = await storage.getObjectBuffer(key);
    const served = await patchAiAuthorHtmlIfNeeded(packageId, rel, buf);

    res.setHeader('Content-Type', guessContentType(rel));
    res.setHeader('Cache-Control', served.patched ? 'private, no-store' : 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
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
        await sendContent(res, access.packageId, rel);
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
        await sendContent(res, packageId, rel);
    } catch (err) {
        res.status(404).json({ message: 'Content not found' });
    }
});

router.patchAuthoredHtml = patchAuthoredHtml;
router.authoredRuntimeBridge = authoredRuntimeBridge;
module.exports = router;
