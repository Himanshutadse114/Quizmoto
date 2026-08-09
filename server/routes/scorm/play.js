/**
 * Same-origin SCORM / xAPI player shell.
 *
 * v2 tracking is local-first: the SCORM API is synchronous and entirely in
 * memory, while a complete attempt-state document is persisted asynchronously.
 * A slow database can therefore never make LMSInitialize/Get/Set/Commit fail.
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

        const entryHref = String(req.query.entryHref || pkg.entryHref || 'index.html').replace(/^\/+/, '');
        const tokEnc = encodeURIComponent(token);
        const contentSrc = '/api/scorm/content/t/' + tokEnc + '/' + entryHref.split('/').map(encodeURIComponent).join('/');
        const sessionEndpoint = '/api/scorm/session/' + reg.id;
        const xapiEndpoint = '/api/scorm/xapi/statements';
        const learnerName = reg.learnerName || 'Learner';
        const courseTitle = reg.course.title || 'SCORM Player';

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
html,body{margin:0;height:100%;background:#0d0618;color:#fff;font-family:system-ui,sans-serif}
#bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#000;border-bottom:1px solid #ffffff22;font-size:12px;height:42px;box-sizing:border-box}
#bar button{background:#ffffff18;border:0;color:#fff;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
#bar button:hover{background:#ffffff28}
#frame{border:0;width:100%;height:calc(100% - 42px);display:block;background:#111}
#status{opacity:.78}
</style>
<script>
(function(){
var BOOT=${boot};
var TOKEN=BOOT.token,SESSION=BOOT.sessionEndpoint,XAPI_EP=BOOT.xapiEndpoint;
var initialized=false,stateLoaded=false,localValues=Object.create(null);
var dirty=false,revision=0,savedRevision=-1,saveTimer=null,saveInFlight=false,saveAgain=false;
var lastError={code:0};
var ERRORS={0:"No error",101:"General exception",201:"Invalid argument error",301:"Not initialized",351:"Not implemented error",391:"Not initialized error",402:"Invalid set value",403:"Element is read only",404:"Element is write only",405:"Incorrect data type"};

function setStatus(t){try{var el=document.getElementById("status");if(el)el.textContent=t;}catch(e){}}
function notifyOpener(type,data){try{if(window.opener&&!window.opener.closed){window.opener.postMessage({type:type,registrationId:BOOT.registrationId,data:data||null},"*");}}catch(e){}}
function copyValues(input){var out=Object.create(null);if(!input||typeof input!=="object")return out;Object.keys(input).forEach(function(k){out[String(k)]=input[k]==null?"":String(input[k]);});return out;}
function putDefault(key,value){if(!Object.prototype.hasOwnProperty.call(localValues,key)||localValues[key]==null||localValues[key]==="")localValues[key]=value;}
function installDefaults(resume){
  putDefault("cmi.core.student_id",BOOT.registrationId);
  putDefault("cmi.core.student_name",BOOT.learnerName);
  putDefault("cmi.learner_id",BOOT.registrationId);
  putDefault("cmi.learner_name",BOOT.learnerName);
  putDefault("cmi.core.lesson_status","not attempted");
  putDefault("cmi.completion_status","unknown");
  putDefault("cmi.success_status","unknown");
  putDefault("cmi.core.total_time","00:00:00.00");
  putDefault("cmi.total_time","PT0S");
  putDefault("cmi.core.lesson_mode","normal");
  putDefault("cmi.mode","normal");
  localValues["cmi.core.entry"]=resume?"resume":"ab-initio";
  localValues["cmi.entry"]=resume?"resume":"ab-initio";
}
function snapshotPayload(eventName){return JSON.stringify({event:eventName||"commit",clientVersion:2,clientRevision:revision,values:localValues});}
function clearSaveTimer(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}}
function scheduleSave(delay,eventName){if(!initialized&&!stateLoaded)return;clearSaveTimer();saveTimer=setTimeout(function(){saveTimer=null;persist(eventName||"autosave",false);},delay==null?1200:delay);}
function persist(eventName,keepalive){
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
function loadSavedState(){
  setStatus("SCORM - loading saved progress");
  fetch(SESSION,{method:"GET",headers:{"Authorization":"Bearer "+TOKEN},credentials:"same-origin",cache:"no-store"})
    .then(function(r){if(!r.ok)throw new Error("state load "+r.status);return r.json();})
    .then(function(d){localValues=copyValues(d&&d.values);revision=Math.max(0,Number(d&&d.clientRevision||0));savedRevision=revision;installDefaults(!!(d&&d.resume));stateLoaded=true;setStatus("SCORM - "+(d&&d.resume?"progress restored":"ready"));})
    .catch(function(){localValues=Object.create(null);installDefaults(false);stateLoaded=true;setStatus("SCORM - ready · save service retrying");})
    .finally(loadContent);
}

var api12={
  LMSInitialize:function(){
    initialized=true;lastError.code=0;dirty=true;revision++;
    setStatus("SCORM - "+(localValues["cmi.core.entry"]==="resume"?"resumed":"started"));
    scheduleSave(120,"initialize");return "true";
  },
  LMSFinish:function(){beaconPersist("finish");initialized=false;lastError.code=0;setStatus("SCORM - finished · saving");return "true";},
  LMSGetValue:function(el){var key=String(el||"");lastError.code=0;return Object.prototype.hasOwnProperty.call(localValues,key)?String(localValues[key]):"";},
  LMSSetValue:function(el,v){if(!initialized){lastError.code=301;return "false";}var key=String(el||"");localValues[key]=v==null?"":String(v);dirty=true;revision++;lastError.code=0;scheduleSave(900,"autosave");return "true";},
  LMSCommit:function(){if(initialized){dirty=true;revision++;persist("commit",false);}lastError.code=0;return "true";},
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
window.__quizmotoBeaconState=function(eventName){return beaconPersist(eventName||"lifecycle");};
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"&&(dirty||initialized))beaconPersist("visibility-hidden");});
window.addEventListener("pagehide",function(){if(dirty||initialized)beaconPersist("pagehide");});
setInterval(function(){if(dirty&&!saveInFlight)persist("heartbeat",false);},5000);
window.addEventListener("DOMContentLoaded",loadSavedState);
})();
</script>
</head>
<body>
<div id="bar">
  <span id="status">SCORM - preparing learner state</span>
  <div><button type="button" id="btnSave">Save</button><button type="button" id="btnExit">Exit</button></div>
</div>
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
document.getElementById("btnSave").onclick=function(){try{window.API.LMSCommit("");}catch(e){}};
document.getElementById("btnExit").onclick=function(){persistAndFinish();closePlayer();};
})();
</script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
        res.send(html);
    } catch (err) {
        console.error('[scorm-player-v2] launch failed', {
            registrationId: req.params.regId,
            error: err?.message || String(err)
        });
        res.status(500).send('Player error: ' + (err.message || 'unknown'));
    }
});

module.exports = router;
