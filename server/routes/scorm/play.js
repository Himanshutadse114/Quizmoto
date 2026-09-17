/**
 * Same-origin SCORM / xAPI player shell.
 *
 * Tracking is local-first: the SCORM API remains synchronous in memory while
 * the complete state document is persisted asynchronously to the canonical
 * runtime snapshot store. The shell also owns launch and elapsed-time tracking,
 * so a quiet or imperfect SCO cannot leave an opened course as "not attempted".
 */
const express = require('express');
const router = express.Router();
const { verifyRegistrationToken } = require('../../services/scorm/ScormInviteService');
const { ScormRegistration, ScormCourse, ScormPackage } = require('../../models/scorm');

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
        const courseTitle = reg.course.title || 'SCORM Player';
        const presentationLight = pkg.source === 'presentation_import';
        // Authored course formats own their complete course chrome and autosave
        // through the parent SCORM API. The floating Save/Exit utility belongs
        // only to exact PDF presentation courses, where it is part of the
        // dedicated presentation player experience.
        const showUtilityBar = presentationLight;
        const shellTheme = presentationLight
            ? {
                background: '#eef8f6',
                text: '#123c38',
                barBackground: '#ffffffee',
                barBorder: '#147d7538',
                barShadow: '#123c3824',
                buttonBackground: '#e5f5f2',
                buttonBorder: '#147d7533',
                buttonText: '#123c38',
                buttonHover: '#d4eee9',
                frameBackground: '#eef8f6',
                mobileBar: 'top:max(6px,env(safe-area-inset-top));bottom:auto'
            }
            : {
                background: '#080b10',
                text: '#ffffff',
                barBackground: '#07100fe8',
                barBorder: '#ffffff24',
                barShadow: '#0007',
                buttonBackground: '#ffffff12',
                buttonBorder: '#ffffff12',
                buttonText: '#ffffff',
                buttonHover: '#ffffff25',
                frameBackground: '#111111',
                mobileBar: 'top:auto;bottom:max(6px,env(safe-area-inset-bottom))'
            };

        const boot = JSON.stringify({
            token,
            registrationId: String(reg.id),
            sessionEndpoint,
            xapiEndpoint,
            learnerName,
            contentSrc
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(courseTitle)}</title>
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${shellTheme.background};color:${shellTheme.text};font-family:system-ui,sans-serif}
#bar{position:fixed;z-index:10;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));display:flex;align-items:center;padding:6px;border:1px solid ${shellTheme.barBorder};border-radius:14px;background:${shellTheme.barBackground};box-shadow:0 8px 28px ${shellTheme.barShadow};backdrop-filter:blur(10px)}
#bar>div{display:flex;align-items:center;gap:6px}
#bar button{min-width:64px;min-height:36px;background:${shellTheme.buttonBackground};border:1px solid ${shellTheme.buttonBorder};color:${shellTheme.buttonText};padding:7px 14px;border-radius:9px;font-weight:700;cursor:pointer;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
#bar button:hover,#bar button:focus-visible{background:${shellTheme.buttonHover};outline:none}
#bar button:focus-visible{box-shadow:0 0 0 2px #56d7cf}
#frame{border:0;width:100%;height:100%;display:block;background:${shellTheme.frameBackground}}
#status{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@media(max-width:520px){#bar{${shellTheme.mobileBar};right:max(6px,env(safe-area-inset-right));padding:5px}#bar>div{gap:5px}#bar button{min-width:58px;min-height:32px;padding:6px 11px;font-size:9px}}
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
      if(d&&d.summary&&d.summary.lessonStatus)setStatus("SCORM - "+d.summary.lessonStatus+" · saved");else setStatus("SCORM - progress saved");
      notifyOpener("quizmoto-scorm-progress",d&&d.summary?d.summary:null);
    })
    .catch(function(){dirty=true;lastError.code=101;setStatus("SCORM - saving will retry");})
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
function loadContent(){
  try{var frame=document.getElementById("frame");if(frame&&!frame.getAttribute("data-loaded")){frame.setAttribute("data-loaded","1");frame.src=BOOT.contentSrc;}}catch(e){}
}
function beginLaunchTracking(d){
  installDefaults(!!(d&&d.resume));installTimeBaseline(d||{});stateLoaded=true;dirty=true;revision++;
  scheduleSave(150,"launch");
}
function loadSavedState(){
  setStatus("SCORM - loading saved progress");
  fetch(SESSION,{method:"GET",headers:{"Authorization":"Bearer "+TOKEN},credentials:"same-origin",cache:"no-store"})
    .then(function(r){if(!r.ok)throw new Error("state load "+r.status);return r.json();})
    .then(function(d){localValues=copyValues(d&&d.values);revision=Math.max(0,Number(d&&d.clientRevision||0));savedRevision=revision;beginLaunchTracking(d||{});setStatus("SCORM - "+(d&&d.resume?"progress restored":"started"));})
    .catch(function(){localValues=Object.create(null);revision=0;savedRevision=-1;beginLaunchTracking({});setStatus("SCORM - started · save service retrying");})
    .finally(loadContent);
}

var api12={
  LMSInitialize:function(){
    initialized=true;if(!sessionStartedAt)sessionStartedAt=Date.now();lastError.code=0;dirty=true;revision++;
    setStatus("SCORM - "+(localValues["cmi.core.entry"]==="resume"?"resumed":"started"));
    scheduleSave(120,"initialize");return "true";
  },
  LMSFinish:function(){dirty=true;revision++;beaconPersist("finish");initialized=false;lastError.code=0;setStatus("SCORM - finished · saving");return "true";},
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
${showUtilityBar ? `<div id="bar">
  <span id="status">SCORM - preparing learner state</span>
  <div><button type="button" id="btnSave">Save</button><button type="button" id="btnExit">Exit</button></div>
</div>` : '<span id="status">SCORM - preparing learner state</span>'}
<iframe id="frame" name="scorm_content" title="SCORM Content" src="about:blank" allow="autoplay; fullscreen" allowfullscreen></iframe>
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
