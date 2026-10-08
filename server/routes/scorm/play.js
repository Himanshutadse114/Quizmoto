/**
 * Same-origin SCORM / xAPI player shell.
 *
 * Tracking is local-first: the SCORM API remains synchronous in memory while
 * the complete state document is persisted asynchronously to the canonical
 * runtime snapshot store. The shell also owns launch and elapsed-time tracking,
 * so a quiet or imperfect SCO cannot leave an opened course as "not attempted".
 */
const express = require('express');
const fs = require('fs');
const router = express.Router();
const { verifyRegistrationToken } = require('../../services/scorm/ScormInviteService');
const { ScormRegistration, ScormCourse, ScormPackage } = require('../../models/scorm');

function embeddedInterFont(weight) {
    try {
        return fs.readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff2`)).toString('base64');
    } catch (_) {
        return '';
    }
}

const PRESENTATION_INTER_FONTS = Object.freeze({
    regular: embeddedInterFont(400),
    semibold: embeddedInterFont(600),
    bold: embeddedInterFont(800)
});

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

router.get('/:regId', async (req, res) => {
    try {
        const token = req.query.token || '';
        if (!token) return res.status(400).send('Missing token');

        let decoded;
        try {
            decoded = verifyRegistrationToken(token);
        } catch (_) {
            return res.status(401).send('Invalid or expired token');
        }

        if (String(decoded.scormRegId) !== String(req.params.regId)) {
            return res.status(403).send('Token does not match registration');
        }

        const reg = await ScormRegistration.findByPk(req.params.regId, {
            include: [{
                model: ScormCourse,
                as: 'course',
                include: [{ model: ScormPackage, as: 'package' }]
            }]
        });

        if (!reg || reg.status === 'revoked' || !reg.course || !reg.course.package) {
            return res.status(404).send('Registration or package not found');
        }

        const pkg = reg.course.package;
        if (pkg.status !== 'ready') return res.status(409).send('Package not ready');

        const embeddedPreview = Boolean(reg.isPreview) && String(req.query.previewEmbed || '') === '1';
        const entryHref = String(req.query.entryHref || pkg.entryHref || 'index.html').replace(/^\/+/, '');
        const tokEnc = encodeURIComponent(token);
        const contentSrc = '/api/scorm/content/t/' + tokEnc + '/' + entryHref.split('/').map(encodeURIComponent).join('/') + (embeddedPreview ? '?previewEmbed=1' : '');
        const sessionEndpoint = '/api/scorm/session/' + reg.id;
        const xapiEndpoint = '/api/scorm/xapi/statements';
        const learnerName = reg.learnerName || 'Learner';
        const courseTitle = reg.course.title || 'Course Player';
        const presentationLight = pkg.source === 'presentation_import';
        // Fit the whole desktop player, not just uploaded packages. A fixed
        // iframe viewport keeps both CSS and JavaScript in desktop layout.
        const scaleCourseDesktop = true;
        // Every course autosaves through the parent runtime. Course-specific
        // navigation stays inside the player so no floating controls obscure it.
        const shellTheme = presentationLight
            ? {
                background: '#eef8f6',
                text: '#123c38',
                frameBackground: '#eef8f6'
            }
            : {
                background: '#080b10',
                text: '#ffffff',
                frameBackground: '#111111'
            };

        const boot = JSON.stringify({
            token,
            registrationId: String(reg.id),
            sessionEndpoint,
            xapiEndpoint,
            learnerName,
            contentSrc,
            presentationLight,
            scaleCourseDesktop,
            presentationInterFonts: presentationLight ? PRESENTATION_INTER_FONTS : null
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(courseTitle)}</title>
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${shellTheme.background};color:${shellTheme.text};font-family:system-ui,sans-serif}
#frame-viewport{position:relative;width:100%;height:100%;overflow:hidden;background:${shellTheme.frameBackground}}
#frame{border:0;width:100%;height:100%;display:block;background:${shellTheme.frameBackground}}
html.qmx-course-desktop-fit #frame{position:absolute;left:var(--qmx-course-left,0);top:var(--qmx-course-top,0);width:1280px;height:720px;max-width:none;max-height:none;transform:scale(var(--qmx-course-scale,1));transform-origin:top left}
#status{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
</style>
<script>
(function(){
var BOOT=${boot};
var TOKEN=BOOT.token,SESSION=BOOT.sessionEndpoint,XAPI_EP=BOOT.xapiEndpoint;
var initialized=false,stateLoaded=false,localValues=Object.create(null);
var dirty=false,revision=0,savedRevision=-1,saveTimer=null,saveInFlight=false,saveAgain=false;
var timeBaselineSeconds=0,sessionStartedAt=0;
var lastError={code:0};
var ERRORS={0:"No error",101:"General exception",201:"Invalid argument error",301:"Not initialized",351:"Not implemented error",391:"Not initialized error",402:"Invalid set value",403:"Element is read only",404:"Element is write only",405:"Incorrect data type"};

function setStatus(t){try{var el=document.getElementById("status");if(el)el.textContent=t;}catch(e){}}
function notifyOpener(type,data){try{if(window.opener&&!window.opener.closed){window.opener.postMessage({type:type,registrationId:BOOT.registrationId,data:data||null},"*");}}catch(e){}}
function copyValues(input){var out=Object.create(null);if(!input||typeof input!=="object")return out;Object.keys(input).forEach(function(k){out[String(k)]=input[k]==null?"":String(input[k]);});return out;}
function putDefault(key,value){if(!Object.prototype.hasOwnProperty.call(localValues,key)||localValues[key]==null||localValues[key]==="")localValues[key]=value;}
function parseTimeSeconds(value){
  var s=String(value||"").trim(),m=s.match(/^(\\d+):(\\d{1,2}):(\\d{1,2}(?:\\.\\d+)?)$/);if(m)return Number(m[1])*3600+Number(m[2])*60+Number(m[3]);
  m=s.match(/^P(?:([\\d.]+)D)?(?:T(?:([\\d.]+)H)?(?:([\\d.]+)M)?(?:([\\d.]+)S)?)?$/i);if(m)return Number(m[1]||0)*86400+Number(m[2]||0)*3600+Number(m[3]||0)*60+Number(m[4]||0);
  return 0;
}
function absoluteTrackedSeconds(){var elapsed=sessionStartedAt?Math.max(0,(Date.now()-sessionStartedAt)/1000):0;return Math.max(0,timeBaselineSeconds+elapsed);}
function installTimeBaseline(d){
  var values=d&&d.values&&typeof d.values==="object"?d.values:{};
  var absolute=Number(values["quizmoto.total_time_seconds"]);
  if(Number.isFinite(absolute)&&absolute>=0)timeBaselineSeconds=absolute;else timeBaselineSeconds=parseTimeSeconds(d&&d.totalTime);
  sessionStartedAt=Date.now();
}
function installDefaults(resume){
  putDefault("cmi.core.student_id",BOOT.registrationId);
  putDefault("cmi.core.student_name",BOOT.learnerName);
  putDefault("cmi.learner_id",BOOT.registrationId);
  putDefault("cmi.learner_name",BOOT.learnerName);
  putDefault("cmi.core.lesson_status","incomplete");
  putDefault("cmi.completion_status","incomplete");
  putDefault("cmi.success_status","unknown");
  putDefault("cmi.core.total_time","00:00:00.00");
  putDefault("cmi.total_time","PT0S");
  putDefault("cmi.core.lesson_mode","normal");
  putDefault("cmi.mode","normal");
  localValues["cmi.core.entry"]=resume?"resume":"ab-initio";
  localValues["cmi.entry"]=resume?"resume":"ab-initio";
}
function snapshotValues(){var values=copyValues(localValues);values["quizmoto.total_time_seconds"]=String(Math.round(absoluteTrackedSeconds()*100)/100);return values;}
function snapshotPayload(eventName){return JSON.stringify({event:eventName||"commit",clientVersion:4,clientRevision:revision,values:snapshotValues()});}
function clearSaveTimer(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}}
function scheduleSave(delay,eventName){if(!stateLoaded&&!initialized)return;clearSaveTimer();saveTimer=setTimeout(function(){saveTimer=null;persist(eventName||"autosave",false);},delay==null?1200:delay);}
function persist(eventName,keepalive){
  if(!stateLoaded)return;
  if(saveInFlight){saveAgain=true;return;}
  var capturedRevision=revision;
  var body=snapshotPayload(eventName);
  saveInFlight=true;
  fetch(SESSION,{method:"POST",headers:{"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"},body:body,credentials:"same-origin",cache:"no-store",keepalive:!!keepalive&&body.length<60000})
    .then(function(r){if(!r.ok)throw new Error("state save "+r.status);return r.json();})
    .then(function(d){
      lastError.code=0;savedRevision=Math.max(savedRevision,capturedRevision);
      if(revision===capturedRevision)dirty=false;
      if(d&&d.summary&&d.summary.lessonStatus)setStatus("Course - "+d.summary.lessonStatus+" · saved");else setStatus("Course - progress saved");
      notifyOpener("quizmoto-scorm-progress",d&&d.summary?d.summary:null);
    })
    .catch(function(){dirty=true;lastError.code=101;setStatus("Course - saving will retry");})
    .finally(function(){saveInFlight=false;if(saveAgain||dirty&&revision>savedRevision){saveAgain=false;scheduleSave(1500,"retry");}});
}
function beaconPersist(eventName){
  if(!stateLoaded)return false;
  clearSaveTimer();
  var body=snapshotPayload(eventName);
  var url=SESSION+"?token="+encodeURIComponent(TOKEN);
  var queued=false;
  try{
    if(navigator.sendBeacon&&body.length<60000){queued=navigator.sendBeacon(url,new Blob([body],{type:"application/json"}));}
  }catch(e){}
  if(!queued){
    try{fetch(SESSION,{method:"POST",headers:{"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"},body:body,credentials:"same-origin",cache:"no-store",keepalive:body.length<60000}).catch(function(){});}catch(e){}
  }
  return true;
}
function applyPresentationLayoutGuard(){
  if(!BOOT.presentationLight)return;
  try{
    var frame=document.getElementById("frame"),doc=frame&&frame.contentDocument;if(!doc)return;
    // The current player owns its complete content-first shell. Earlier
    // self-contained players are upgraded here as well so saved courses pick
    // up the presentation-first layout without being rebuilt or re-uploaded.
    var playerVersion=doc.documentElement&&doc.documentElement.getAttribute("data-lmsgen-presentation-player");
    if(playerVersion==="content-first-v3")return;
    var style=doc.getElementById("lmsgen-exact-slide-fit-guard");
    if(!style){
      var fonts=BOOT.presentationInterFonts||{},fontCss="";
      if(fonts.regular)fontCss+='@font-face{font-family:"Inter";src:url("data:font/woff2;base64,'+fonts.regular+'") format("woff2");font-style:normal;font-weight:400;font-display:swap}';
      if(fonts.semibold)fontCss+='@font-face{font-family:"Inter";src:url("data:font/woff2;base64,'+fonts.semibold+'") format("woff2");font-style:normal;font-weight:600;font-display:swap}';
      if(fonts.bold)fontCss+='@font-face{font-family:"Inter";src:url("data:font/woff2;base64,'+fonts.bold+'") format("woff2");font-style:normal;font-weight:800;font-display:swap}';
      style=doc.createElement("style");style.id="lmsgen-exact-slide-fit-guard";style.textContent=fontCss+'html,body{font-family:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif!important}#app{position:relative!important;height:100%!important;padding:0!important;gap:0!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:56px minmax(0,1fr) 60px!important;grid-template-areas:"header" "stage" "controls"!important;background:#020908!important}.topbar{grid-area:header!important;min-height:56px!important;padding:7px clamp(12px,1.6vw,24px)!important;background:#081b18!important;border:0!important;border-bottom:1px solid rgba(115,221,210,.24)!important;box-shadow:none!important}.topbar:after{height:2px!important;background:linear-gradient(90deg,#147d75,#4fc9bf)!important}.brand{max-width:34vw!important}.rail-logo{max-width:106px!important;max-height:30px!important}.rail-kicker{color:#74ddd4!important;font-size:.55rem!important}.title{color:#fff!important;font-size:clamp(.78rem,1vw,.94rem)!important}.course-sub{color:#9ab8b3!important;font-size:.58rem!important}.topbar-right{min-width:0!important;gap:9px!important}.rail-progress{width:min(220px,22vw)!important;gap:4px!important}.progress-meta{color:#9ab8b3!important;font-size:.58rem!important}.progress-label{color:#fff!important}.progress-track{height:5px!important;background:rgba(255,255,255,.14)!important}.tabs{position:absolute!important;z-index:6!important;top:8px!important;left:50%!important;transform:translateX(-50%)!important;display:flex!important;align-items:center!important;gap:3px!important;padding:3px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:10px!important;background:rgba(255,255,255,.06)!important}.tab{min-height:34px!important;padding:6px 14px!important;border:0!important;border-radius:7px!important;background:transparent!important;color:#a9c5c0!important;font-size:.64rem!important}.tab.active{margin:0!important;background:#fff!important;color:#123c38!important;box-shadow:0 3px 12px rgba(0,0,0,.2)!important}.btn-presentation{min-width:40px!important;min-height:40px!important;padding:7px 10px!important;border-color:rgba(255,255,255,.18)!important;background:rgba(255,255,255,.06)!important;color:#fff!important}.status-pill{color:#74ddd4!important;border-color:rgba(116,221,212,.34)!important;background:rgba(20,125,117,.18)!important}.course-rail{grid-area:controls!important;min-height:60px!important;padding:8px clamp(12px,1.6vw,24px)!important;display:flex!important;align-items:center!important;background:#081b18!important;border:0!important;border-top:1px solid rgba(115,221,210,.18)!important;box-shadow:none!important;overflow:hidden!important}.rail-heading,.rail-section{display:none!important}.rail-controls{width:100%!important;margin:0!important;display:grid!important;grid-template-columns:minmax(110px,1fr) auto minmax(110px,1fr)!important;align-items:center!important;gap:12px!important}.counter{color:#fff!important;font-size:.68rem!important}.nav-buttons{display:flex!important;justify-content:center!important;gap:8px!important}.btn{min-width:96px!important;min-height:42px!important;padding:8px 14px!important;border-radius:10px!important;font-size:.68rem!important}.btn-secondary{border-color:rgba(255,255,255,.18)!important;background:rgba(255,255,255,.06)!important;color:#fff!important}.btn-primary{background:#2fb9ae!important;color:#041c19!important}.shortcut{display:block!important;color:#88a9a4!important;font-size:.56rem!important}.presentation-page,main{background:#020908!important}main{grid-area:stage!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;aspect-ratio:auto!important;align-self:stretch!important;justify-self:stretch!important;box-shadow:none!important}.presentation-page{inset:0!important;padding:10px!important;align-items:center!important;justify-content:center!important;background:radial-gradient(circle at 50% 45%,#102a26 0,#071412 64%,#020908 100%)!important}.presentation-page img{display:block!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;background:#fff!important;border-radius:7px!important;box-shadow:0 22px 70px rgba(0,0,0,.5)!important}#app.is-assessment main{width:100%!important;height:100%!important;aspect-ratio:auto!important}.quiz-page,.result-page{background:var(--background)!important}@media(max-width:1080px){.tabs{display:none!important}.brand{max-width:48vw!important}.status-pill{display:none!important}}@media(max-width:820px){#app{grid-template-rows:52px minmax(0,1fr) 60px!important}.topbar{min-height:52px!important;padding:6px 8px!important}.brand{max-width:none!important;min-width:0!important}.rail-kicker,.course-sub{display:none!important}.rail-logo{max-width:72px!important;max-height:26px!important}.title{font-size:.68rem!important}.topbar-right{gap:5px!important}.rail-progress{width:66px!important}.progress-meta span:first-child{display:none!important}.btn-presentation{min-width:38px!important;min-height:38px!important;padding:6px!important}.btn-presentation span{display:none!important}.course-rail{min-height:60px!important;padding:7px 8px!important}.rail-controls{grid-template-columns:auto minmax(0,1fr)!important;gap:8px!important}.counter{font-size:.6rem!important}.nav-buttons{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important}.btn{min-width:0!important;min-height:42px!important;padding:7px 9px!important}.shortcut{display:none!important}.presentation-page{padding:6px!important}.presentation-page img{border-radius:4px!important}}@media(max-height:620px) and (orientation:landscape){#app{grid-template-rows:46px minmax(0,1fr) 50px!important}.topbar{min-height:46px!important;padding:4px 8px!important}.course-rail{min-height:50px!important;padding:5px 8px!important}.btn{min-height:36px!important}.presentation-page{padding:5px!important}}';(doc.head||doc.documentElement).appendChild(style);
    }
    var image=doc.querySelector(".presentation-page img"),width=Number(image&&image.getAttribute("width")),height=Number(image&&image.getAttribute("height"));
    if(width>0&&height>0)doc.documentElement.style.setProperty("--slide-ratio",width+" / "+height);
  }catch(e){}
}
function syncCourseDesktopFit(){
  if(!BOOT.scaleCourseDesktop)return;
  try{
    var root=document.documentElement,visual=window.visualViewport;
    var width=Math.max(1,Math.min(Number(window.innerWidth||1280),Number(visual&&visual.width||window.innerWidth||1280)));
    var height=Math.max(1,Math.min(Number(window.innerHeight||720),Number(visual&&visual.height||window.innerHeight||720)));
    var constrained=width<1280||height<720;
    root.classList.toggle("qmx-course-desktop-fit",constrained);
    if(!constrained){
      root.style.removeProperty("--qmx-course-scale");
      root.style.removeProperty("--qmx-course-left");
      root.style.removeProperty("--qmx-course-top");
      return;
    }
    var scale=Math.max(.01,Math.min(1,width/1280,height/720));
    var left=Number(visual&&visual.offsetLeft||0)+Math.max(0,(width-1280*scale)/2);
    var top=Number(visual&&visual.offsetTop||0)+Math.max(0,(height-720*scale)/2);
    root.style.setProperty("--qmx-course-scale",scale.toFixed(6));
    root.style.setProperty("--qmx-course-left",left.toFixed(2)+"px");
    root.style.setProperty("--qmx-course-top",top.toFixed(2)+"px");
  }catch(e){}
}
function installCourseDesktopFit(){
  if(!BOOT.scaleCourseDesktop)return;
  var queued=false;
  function schedule(){
    if(queued)return;queued=true;
    (window.requestAnimationFrame||function(fn){return setTimeout(fn,16);})(function(){queued=false;syncCourseDesktopFit();});
  }
  syncCourseDesktopFit();
  window.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("orientationchange",schedule,{passive:true});
  if(window.visualViewport){window.visualViewport.addEventListener("resize",schedule,{passive:true});window.visualViewport.addEventListener("scroll",schedule,{passive:true});}
}
function loadContent(){
  try{var frame=document.getElementById("frame");if(frame&&!frame.getAttribute("data-loaded")){installCourseDesktopFit();frame.setAttribute("data-loaded","1");frame.addEventListener("load",applyPresentationLayoutGuard);frame.src=BOOT.contentSrc;}}catch(e){}
}
function beginLaunchTracking(d){
  installDefaults(!!(d&&d.resume));installTimeBaseline(d||{});stateLoaded=true;dirty=true;revision++;
  scheduleSave(150,"launch");
}
function loadSavedState(){
  setStatus("Course - loading saved progress");
  fetch(SESSION,{method:"GET",headers:{"Authorization":"Bearer "+TOKEN},credentials:"same-origin",cache:"no-store"})
    .then(function(r){if(!r.ok)throw new Error("state load "+r.status);return r.json();})
    .then(function(d){localValues=copyValues(d&&d.values);revision=Math.max(0,Number(d&&d.clientRevision||0));savedRevision=revision;beginLaunchTracking(d||{});setStatus("Course - "+(d&&d.resume?"progress restored":"started"));})
    .catch(function(){localValues=Object.create(null);revision=0;savedRevision=-1;beginLaunchTracking({});setStatus("Course - started · save service retrying");})
    .finally(loadContent);
}

var api12={
  LMSInitialize:function(){
    initialized=true;if(!sessionStartedAt)sessionStartedAt=Date.now();lastError.code=0;dirty=true;revision++;
    setStatus("Course - "+(localValues["cmi.core.entry"]==="resume"?"resumed":"started"));
    scheduleSave(120,"initialize");return "true";
  },
  LMSFinish:function(){dirty=true;revision++;beaconPersist("finish");initialized=false;lastError.code=0;setStatus("Course - finished · saving");return "true";},
  LMSGetValue:function(el){var key=String(el||"");lastError.code=0;return Object.prototype.hasOwnProperty.call(localValues,key)?String(localValues[key]):"";},
  LMSSetValue:function(el,v){if(!initialized){lastError.code=301;return "false";}var key=String(el||"");localValues[key]=v==null?"":String(v);dirty=true;revision++;lastError.code=0;scheduleSave(900,"autosave");return "true";},
  LMSCommit:function(){if(stateLoaded){dirty=true;revision++;persist("commit",false);}lastError.code=0;return "true";},
  LMSGetLastError:function(){return String(lastError.code||0);},
  LMSGetErrorString:function(code){return ERRORS[Number(code)]||"Unknown error";},
  LMSGetDiagnostic:function(code){return api12.LMSGetErrorString(code);}
};
var api2004={
  Initialize:function(p){return api12.LMSInitialize(p==null?"":p);},
  Terminate:function(p){return api12.LMSFinish(p==null?"":p);},
  GetValue:function(el){return api12.LMSGetValue(el);},
  SetValue:function(el,v){return api12.LMSSetValue(el,v);},
  Commit:function(p){return api12.LMSCommit(p==null?"":p);},
  GetLastError:function(){return api12.LMSGetLastError();},
  GetErrorString:function(c){return api12.LMSGetErrorString(c);},
  GetDiagnostic:function(c){return api12.LMSGetDiagnostic(c);}
};
window.API=api12;window.API_1484_11=api2004;
window.ADL=window.ADL||{};window.ADL.XAPIWrapper=window.ADL.XAPIWrapper||{};
window.ADL.XAPIWrapper.config={endpoint:XAPI_EP+(XAPI_EP.slice(-1)==="/"?"":"/"),auth:"Bearer "+TOKEN,actor:{name:BOOT.learnerName,objectType:"Agent"}};
window.ADL.XAPIWrapper.sendStatement=function(stmt,cb){try{var x=new XMLHttpRequest();x.open("POST",XAPI_EP,true);x.setRequestHeader("Authorization","Bearer "+TOKEN);x.setRequestHeader("Content-Type","application/json");x.setRequestHeader("X-Experience-API-Version","1.0.3");x.onload=function(){if(cb)cb(x);};x.send(JSON.stringify(stmt));return true;}catch(e){return false;}};
try{if(window.top&&window.top!==window){window.top.API=api12;window.top.API_1484_11=api2004;window.top.ADL=window.ADL;}}catch(e){}
window.__quizmotoScormReady=true;
window.__quizmotoPersistState=function(eventName){dirty=true;revision++;persist(eventName||"manual",false);};
window.__quizmotoBeaconState=function(eventName){dirty=true;revision++;return beaconPersist(eventName||"lifecycle");};
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"&&stateLoaded){dirty=true;revision++;beaconPersist("visibility-hidden");}});
window.addEventListener("pagehide",function(){if(stateLoaded){dirty=true;revision++;beaconPersist("pagehide");}});
window.addEventListener("beforeunload",function(){if(stateLoaded){dirty=true;revision++;beaconPersist("beforeunload");}});
// Persist elapsed wall-clock time even if the SCO never discovers or initializes
// the SCORM API. This prevents an opened course from remaining at zero time.
setInterval(function(){if(stateLoaded&&!saveInFlight){dirty=true;revision++;persist("heartbeat",false);}},5000);
window.addEventListener("DOMContentLoaded",loadSavedState);
})();
</script>
</head>
<body>
<span id="status">Course - preparing learner state</span>
<div id="frame-viewport"><iframe id="frame" name="scorm_content" title="Course content" src="about:blank" allow="autoplay; fullscreen" allowfullscreen></iframe></div>
<script>
(function(){
var exiting=false;
function flushFrameState(){
  try{
    var frame=document.getElementById("frame"),w=frame&&frame.contentWindow;if(!w)return "none";
    if(typeof w.__quizmotoFlushScormState==="function"){w.__quizmotoFlushScormState(true);return "explicit";}
  }catch(e){}return "none";
}
function persistAndFinish(){
  if(exiting)return;exiting=true;
  flushFrameState();
  try{window.API.LMSCommit("");}catch(e){}
  try{window.API.LMSFinish("");}catch(e){}
}
function notifyParentExit(){try{if(window.opener&&!window.opener.closed){window.opener.postMessage({type:"quizmoto-scorm-exit",registrationId:${JSON.stringify(String(reg.id))}},"*");}}catch(e){}}
function closePlayer(){
  try{notifyParentExit();}catch(e){}
  try{window.close();}catch(e){}
  setTimeout(function(){try{window.location.href="about:blank";}catch(e2){}},200);
}
var saveButton=document.getElementById("btnSave"),exitButton=document.getElementById("btnExit");
if(saveButton)saveButton.onclick=function(){try{window.__quizmotoPersistState("manual-save");}catch(e){try{window.API.LMSCommit("");}catch(e2){}}};
if(exitButton)exitButton.onclick=function(){persistAndFinish();closePlayer();};
})();
</script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', embeddedPreview ? "frame-ancestors 'self' https: http:" : "frame-ancestors 'self'");
        res.send(html);
    } catch (err) {
        console.error('[scorm-player] launch failed', {
            registrationId: req.params.regId,
            error: err?.message || String(err)
        });
        res.status(500).send('Player error: ' + (err.message || 'unknown'));
    }
});

module.exports = router;
