/**
 * Same-origin SCORM / xAPI player shell.
 * Exposes:
 *   window.API          — SCORM 1.2
 *   window.API_1484_11  — SCORM 2004 (data model; not full sequencing)
 *   window.ADL.XAPIWrapper config + TinCan-friendly POST helper for xAPI
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

function escapeJs(s) {
    return String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/</g, '\\u003c');
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
        if (pkg.status !== 'ready') {
            return res.status(409).send('Package not ready');
        }

        const entryHref = String(req.query.entryHref || pkg.entryHref || 'index.html').replace(/^\/+/, '');
        const tokEnc = encodeURIComponent(token);
        const contentSrc = `/api/scorm/content/t/${tokEnc}/${entryHref}`;
        const runtimeBase = `/api/scorm/runtime/${reg.id}`;
        const xapiEndpoint = `/api/scorm/xapi/statements`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(reg.course.title || 'SCORM Player')}</title>
<style>
  html,body{margin:0;height:100%;background:#1a0a2e;color:#fff;font-family:system-ui,sans-serif}
  #bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#000c;border-bottom:1px solid #ffffff22;font-size:12px}
  #bar button{background:#ffffff18;border:0;color:#fff;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
  #bar button:hover{background:#ffffff28}
  #frame{border:0;width:100%;height:calc(100% - 42px);display:block;background:#000}
  #status{opacity:.7}
</style>
<script>
(function () {
  var TOKEN = '${escapeJs(token)}';
  var RUNTIME = '${escapeJs(runtimeBase)}';
  var XAPI_EP = '${escapeJs(xapiEndpoint)}';
  var lastError = { code: 0 };

  function syncCall(method, path, body) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open(method, path, false);
      xhr.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
      if (method !== 'GET') {
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(body ? JSON.stringify(body) : '{}');
      } else {
        xhr.send(null);
      }
      var data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch (e2) {}
      if (data.errorCode != null) lastError.code = data.errorCode;
      else if (xhr.status >= 400) lastError.code = 101;
      return data;
    } catch (e) {
      lastError.code = 101;
      return { ok: false, value: method === 'GET' ? '' : 'false', errorCode: 101 };
    }
  }

  var ERRORS = {
    0: 'No error', 101: 'General exception', 201: 'Invalid argument error',
    301: 'Not initialized', 351: 'Not implemented error', 391: 'Not initialized error',
    402: 'Invalid set value, element is a keyword', 403: 'Element is read only',
    404: 'Element is write only', 405: 'Incorrect data type'
  };

  function setStatus(t) {
    try {
      var el = document.getElementById('status');
      if (el) el.textContent = t;
    } catch (e) {}
  }

  var api12 = {
    LMSInitialize: function (p) {
      var d = syncCall('POST', RUNTIME + '/initialize', {});
      lastError.code = d.errorCode != null ? d.errorCode : (d.ok === false ? 101 : 0);
      if (d.ok !== false) setStatus('SCORM · ' + (d.entry === 'resume' ? 'Resumed' : 'Started'));
      return d.ok === false ? 'false' : 'true';
    },
    LMSFinish: function (p) {
      var d = syncCall('POST', RUNTIME + '/finish', {});
      lastError.code = d.errorCode != null ? d.errorCode : 0;
      setStatus('SCORM · ' + (d.summary && d.summary.lessonStatus ? d.summary.lessonStatus : 'Finished'));
      return d.ok === false ? 'false' : 'true';
    },
    LMSGetValue: function (el) {
      var d = syncCall('GET', RUNTIME + '/get?el=' + encodeURIComponent(el || ''));
      return d.value != null ? String(d.value) : '';
    },
    LMSSetValue: function (el, v) {
      var d = syncCall('POST', RUNTIME + '/set', { element: el, value: v });
      return d.ok === false ? 'false' : 'true';
    },
    LMSCommit: function (p) {
      var d = syncCall('POST', RUNTIME + '/commit', {});
      if (d.summary && d.summary.lessonStatus) setStatus('SCORM · ' + d.summary.lessonStatus);
      if (d.summary && d.summary.scoreRaw != null) setStatus('SCORM · score ' + d.summary.scoreRaw);
      return d.ok === false ? 'false' : 'true';
    },
    LMSGetLastError: function () { return String(lastError.code || 0); },
    LMSGetErrorString: function (code) { return ERRORS[Number(code)] || 'Unknown error'; },
    LMSGetDiagnostic: function (code) { return api12.LMSGetErrorString(code); }
  };

  var api2004 = {
    Initialize: function (p) { return api12.LMSInitialize(p == null ? '' : p); },
    Terminate: function (p) { return api12.LMSFinish(p == null ? '' : p); },
    GetValue: function (el) { return api12.LMSGetValue(el); },
    SetValue: function (el, v) { return api12.LMSSetValue(el, v); },
    Commit: function (p) { return api12.LMSCommit(p == null ? '' : p); },
    GetLastError: function () { return api12.LMSGetLastError(); },
    GetErrorString: function (c) { return api12.LMSGetErrorString(c); },
    GetDiagnostic: function (c) { return api12.LMSGetDiagnostic(c); }
  };

  window.API = api12;
  window.API_1484_11 = api2004;

  // xAPI / Tin Can helper (packages that POST statements)
  window.ADL = window.ADL || {};
  window.ADL.XAPIWrapper = window.ADL.XAPIWrapper || {};
  window.ADL.XAPIWrapper.config = {
    endpoint: XAPI_EP.replace(/\/?$/, '/') ,
    auth: 'Bearer ' + TOKEN,
    actor: { name: '${escapeJs(reg.learnerName || 'Learner')}', objectType: 'Agent' }
  };
  window.ADL.XAPIWrapper.sendStatement = function (stmt, callback) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', XAPI_EP, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('X-Experience-API-Version', '1.0.3');
      xhr.onload = function () {
        if (callback) callback(xhr);
      };
      xhr.send(JSON.stringify(stmt));
      return true;
    } catch (e) {
      return false;
    }
  };

  try {
    if (window.top && window.top !== window) {
      window.top.API = api12;
      window.top.API_1484_11 = api2004;
      window.top.ADL = window.ADL;
    }
  } catch (e) {}

  window.__quizmotoScormReady = true;
  window.__quizmotoStandards = { scorm12: true, scorm2004: true, xapi: true };
})();
</script>
</head>
<body>
<div id="bar">
  <span id="status">SCORM / xAPI Player · Ready</span>
  <div>
    <button type="button" id="btnSave">Save</button>
    <button type="button" id="btnExit">Exit</button>
  </div>
</div>
<iframe id="frame" name="scorm_content" title="SCORM Content"
  src="${escapeHtml(contentSrc)}"
  allow="autoplay; fullscreen"
  allowfullscreen></iframe>
<script>
(function () {
  document.getElementById('btnSave').onclick = function () {
    try { window.API.LMSCommit(''); } catch (e) {}
  };
  document.getElementById('btnExit').onclick = function () {
    try { window.API.LMSFinish(''); } catch (e) {}
    if (window.history.length > 1) window.history.back();
    else window.close();
  };
})();
</script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; default-src 'self' 'unsafe-inline' data: blob:;");
        res.send(html);
    } catch (err) {
        res.status(500).send('Player error: ' + (err.message || 'unknown'));
    }
});

module.exports = router;
