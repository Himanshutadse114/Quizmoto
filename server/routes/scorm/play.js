/**
 * Same-origin SCORM / xAPI player shell.
 * Dynamic values are embedded with JSON.stringify so tokens/names cannot break JS syntax.
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
        const runtimeBase = '/api/scorm/runtime/' + reg.id;
        const xapiEndpoint = '/api/scorm/xapi/statements';
        const learnerName = reg.learnerName || 'Learner';
        const courseTitle = reg.course.title || 'SCORM Player';

        // Quizmoto-authored packages use a known CMI surface. SetValue remains a
        // synchronous in-memory operation, while Commit is persisted asynchronously
        // so slide/answer interactions never wait on a network round trip.
        const boot = JSON.stringify({
            token,
            runtimeBase,
            xapiEndpoint,
            learnerName,
            contentSrc,
            bufferedWrites: pkg.source === 'ai_author'
        });

        const html =
            '<!DOCTYPE html>\n' +
            '<html lang="en">\n' +
            '<head>\n' +
            '<meta charset="utf-8" />\n' +
            '<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
            '<title>' + escapeHtml(courseTitle) + '</title>\n' +
            '<style>\n' +
            'html,body{margin:0;height:100%;background:#0d0618;color:#fff;font-family:system-ui,sans-serif}\n' +
            '#bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#000;border-bottom:1px solid #ffffff22;font-size:12px;height:42px;box-sizing:border-box}\n' +
            '#bar button{background:#ffffff18;border:0;color:#fff;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:.06em}\n' +
            '#bar button:hover{background:#ffffff28}\n' +
            '#frame{border:0;width:100%;height:calc(100% - 42px);display:block;background:#111}\n' +
            '#status{opacity:.75}\n' +
            '</style>\n' +
            '<script>\n' +
            '(function(){\n' +
            'var BOOT=' + boot + ';\n' +
            'var TOKEN=BOOT.token,RUNTIME=BOOT.runtimeBase,XAPI_EP=BOOT.xapiEndpoint;\n' +
            'var BUFFERED=BOOT.bufferedWrites===true,initialized=false,pendingValues=Object.create(null),localValues=Object.create(null);\n' +
            'var autosaveTimer=null,autosaveInFlight=false,autosaveAgain=false;\n' +
            'var lastError={code:0};\n' +
            'function setStatus(t){try{var el=document.getElementById("status");if(el)el.textContent=t;}catch(e){}}\n' +
            'function notifyOpener(type,data){try{if(window.opener&&!window.opener.closed){window.opener.postMessage({type:type,registrationId:' + JSON.stringify(String(reg.id)) + ',data:data||null},"*");}}catch(e){}}\n' +
            'function syncCall(method,path,body){\n' +
            '  try{\n' +
            '    var xhr=new XMLHttpRequest();\n' +
            '    xhr.open(method,path,false);\n' +
            '    xhr.setRequestHeader("Authorization","Bearer "+TOKEN);\n' +
            '    if(method!=="GET"){xhr.setRequestHeader("Content-Type","application/json");xhr.send(body?JSON.stringify(body):"{}");}\n' +
            '    else{xhr.send(null);}\n' +
            '    var data={};try{data=JSON.parse(xhr.responseText||"{}");}catch(e2){}\n' +
            '    if(data.errorCode!=null)lastError.code=data.errorCode;else if(xhr.status>=400)lastError.code=101;else lastError.code=0;\n' +
            '    return data;\n' +
            '  }catch(e){lastError.code=101;return {ok:false,value:method==="GET"?"":"false",errorCode:101};}\n' +
            '}\n' +
            'function hasPending(){return Object.keys(pendingValues).length>0;}\n' +
            'function restorePending(values){if(!values)return;Object.keys(values).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(pendingValues,k))pendingValues[k]=values[k];});}\n' +
            'function clearAutosaveTimer(){if(autosaveTimer){clearTimeout(autosaveTimer);autosaveTimer=null;}}\n' +
            'function scheduleAutosave(delay){if(!BUFFERED||!initialized)return;clearAutosaveTimer();autosaveTimer=setTimeout(function(){autosaveTimer=null;asyncFlushBuffered();},delay==null?220:delay);}\n' +
            'function asyncFlushBuffered(){\n' +
            '  if(!BUFFERED||!initialized||!hasPending())return;\n' +
            '  if(autosaveInFlight){autosaveAgain=true;return;}\n' +
            '  var values=pendingValues;pendingValues=Object.create(null);autosaveInFlight=true;\n' +
            '  fetch(RUNTIME+"/commit",{method:"POST",headers:{"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"},body:JSON.stringify({values:values}),credentials:"same-origin",cache:"no-store"})\n' +
            '    .then(function(r){if(!r.ok)throw new Error("commit "+r.status);return r.json();})\n' +
            '    .then(function(d){lastError.code=d.errorCode!=null?d.errorCode:(d.ok===false?101:0);if(d.ok===false){restorePending(values);return;}if(d.summary&&d.summary.lessonStatus)setStatus("SCORM - "+d.summary.lessonStatus);notifyOpener("quizmoto-scorm-progress",d.summary||null);})\n' +
            '    .catch(function(){restorePending(values);lastError.code=101;})\n' +
            '    .finally(function(){autosaveInFlight=false;if(autosaveAgain||hasPending()){autosaveAgain=false;scheduleAutosave(80);}});\n' +
            '}\n' +
            'function flushBuffered(path){\n' +
            '  clearAutosaveTimer();autosaveAgain=false;\n' +
            '  var values=pendingValues;pendingValues=Object.create(null);\n' +
            '  var d=syncCall("POST",path,{values:values});\n' +
            '  if(d.ok===false)restorePending(values);else notifyOpener("quizmoto-scorm-progress",d.summary||null);\n' +
            '  return d;\n' +
            '}\n' +
            'var ERRORS={0:"No error",101:"General exception",201:"Invalid argument error",301:"Not initialized",351:"Not implemented error",391:"Not initialized error",402:"Invalid set value",403:"Element is read only",404:"Element is write only",405:"Incorrect data type"};\n' +
            'var api12={\n' +
            '  LMSInitialize:function(p){var d=syncCall("POST",RUNTIME+"/initialize",{});lastError.code=d.errorCode!=null?d.errorCode:(d.ok===false?101:0);initialized=d.ok!==false;if(initialized){pendingValues=Object.create(null);localValues=Object.create(null);setStatus("SCORM - "+(d.entry==="resume"?"Resumed":"Started"));}return initialized?"true":"false";},\n' +
            '  LMSFinish:function(p){var d=BUFFERED?flushBuffered(RUNTIME+"/finish"):syncCall("POST",RUNTIME+"/finish",{});lastError.code=d.errorCode!=null?d.errorCode:(d.ok===false?101:0);if(d.ok!==false){initialized=false;setStatus("SCORM - "+(d.summary&&d.summary.lessonStatus?d.summary.lessonStatus:"Finished"));}return d.ok===false?"false":"true";},\n' +
            '  LMSGetValue:function(el){if(BUFFERED&&Object.prototype.hasOwnProperty.call(localValues,el)){lastError.code=0;return String(localValues[el]);}var d=syncCall("GET",RUNTIME+"/get?el="+encodeURIComponent(el||""));return d.value!=null?String(d.value):"";},\n' +
            '  LMSSetValue:function(el,v){if(BUFFERED){if(!initialized){lastError.code=301;return "false";}var key=String(el||""),value=v==null?"":String(v);pendingValues[key]=value;localValues[key]=value;lastError.code=0;scheduleAutosave();return "true";}var d=syncCall("POST",RUNTIME+"/set",{element:el,value:v});return d.ok===false?"false":"true";},\n' +
            '  LMSCommit:function(p){if(BUFFERED){scheduleAutosave(0);lastError.code=0;return "true";}var d=syncCall("POST",RUNTIME+"/commit",{});if(d.summary&&d.summary.lessonStatus)setStatus("SCORM - "+d.summary.lessonStatus);if(d.summary&&d.summary.scoreRaw!=null)setStatus("SCORM - score "+d.summary.scoreRaw);return d.ok===false?"false":"true";},\n' +
            '  LMSGetLastError:function(){return String(lastError.code||0);},\n' +
            '  LMSGetErrorString:function(code){return ERRORS[Number(code)]||"Unknown error";},\n' +
            '  LMSGetDiagnostic:function(code){return api12.LMSGetErrorString(code);}\n' +
            '};\n' +
            'var api2004={\n' +
            '  Initialize:function(p){return api12.LMSInitialize(p==null?"":p);},\n' +
            '  Terminate:function(p){return api12.LMSFinish(p==null?"":p);},\n' +
            '  GetValue:function(el){return api12.LMSGetValue(el);},\n' +
            '  SetValue:function(el,v){return api12.LMSSetValue(el,v);},\n' +
            '  Commit:function(p){return api12.LMSCommit(p==null?"":p);},\n' +
            '  GetLastError:function(){return api12.LMSGetLastError();},\n' +
            '  GetErrorString:function(c){return api12.LMSGetErrorString(c);},\n' +
            '  GetDiagnostic:function(c){return api12.LMSGetDiagnostic(c);}\n' +
            '};\n' +
            'window.API=api12;window.API_1484_11=api2004;\n' +
            'window.ADL=window.ADL||{};window.ADL.XAPIWrapper=window.ADL.XAPIWrapper||{};\n' +
            'window.ADL.XAPIWrapper.config={endpoint:XAPI_EP+(XAPI_EP.slice(-1)==="/"?"":"/"),auth:"Bearer "+TOKEN,actor:{name:BOOT.learnerName,objectType:"Agent"}};\n' +
            'window.ADL.XAPIWrapper.sendStatement=function(stmt,cb){try{var x=new XMLHttpRequest();x.open("POST",XAPI_EP,true);x.setRequestHeader("Authorization","Bearer "+TOKEN);x.setRequestHeader("Content-Type","application/json");x.setRequestHeader("X-Experience-API-Version","1.0.3");x.onload=function(){if(cb)cb(x);};x.send(JSON.stringify(stmt));return true;}catch(e){return false;}};\n' +
            'try{if(window.top&&window.top!==window){window.top.API=api12;window.top.API_1484_11=api2004;window.top.ADL=window.ADL;}}catch(e){}\n' +
            'window.__quizmotoScormReady=true;\n' +
            '})();\n' +
            '</script>\n' +
            '</head>\n' +
            '<body>\n' +
            '<div id="bar">\n' +
            '  <span id="status">SCORM / xAPI Player - Ready</span>\n' +
            '  <div><button type="button" id="btnSave">Save</button><button type="button" id="btnExit">Exit</button></div>\n' +
            '</div>\n' +
            '<iframe id="frame" name="scorm_content" title="SCORM Content" src="' + escapeHtml(contentSrc) + '" allow="autoplay; fullscreen" allowfullscreen></iframe>\n' +
            '<script>\n' +
            '(function(){\n' +
            'var exiting=false;\n' +
            'function flushFrameState(){\n' +
            '  try{\n' +
            '    var frame=document.getElementById("frame"),w=frame&&frame.contentWindow;if(!w)return "none";\n' +
            '    if(typeof w.__quizmotoFlushScormState==="function"){w.__quizmotoFlushScormState(true);return "explicit";}\n' +
            '    if(typeof w.dispatchEvent==="function"){var ev;try{ev=new w.Event("beforeunload");}catch(e1){ev=w.document.createEvent("Event");ev.initEvent("beforeunload",false,false);}w.dispatchEvent(ev);return "fallback";}\n' +
            '  }catch(e){}return "none";\n' +
            '}\n' +
            'function persistAndFinish(){\n' +
            '  if(exiting)return;exiting=true;\n' +
            '  var flushMode=flushFrameState();\n' +
            '  if(flushMode!=="explicit"){try{window.API.LMSCommit("");}catch(e){}}\n' +
            '  try{window.API.LMSFinish("");}catch(e){}\n' +
            '}\n' +
            'function closePlayer(){\n' +
            '  try{notifyParentExit();}catch(e){}\n' +
            '  try{window.close();}catch(e){}\n' +
            '  setTimeout(function(){try{window.location.href="about:blank";}catch(e2){}},200);\n' +
            '}\n' +
            'function notifyParentExit(){try{if(window.opener&&!window.opener.closed){window.opener.postMessage({type:"quizmoto-scorm-exit",registrationId:' + JSON.stringify(String(reg.id)) + '},"*");}}catch(e){}}\n' +
            'document.getElementById("btnSave").onclick=function(){try{window.API.LMSCommit("");}catch(e){}};\n' +
            'document.getElementById("btnExit").onclick=function(){persistAndFinish();closePlayer();};\n' +
            'window.addEventListener("beforeunload",function(){persistAndFinish();});\n' +
            '})();\n' +
            '</script>\n' +
            '</body>\n' +
            '</html>';

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
        res.send(html);
    } catch (err) {
        res.status(500).send('Player error: ' + (err.message || 'unknown'));
    }
});

module.exports = router;
