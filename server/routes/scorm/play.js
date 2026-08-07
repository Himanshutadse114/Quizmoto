/**
 * Same-origin SCORM player shell.
 * Served from the backend host so the SCO iframe can find window.API / API_1484_11
 * via the standard parent-frame walk (cross-origin React parent cannot expose API).
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
        if (!token) {
            return res.status(400).send('Missing token');
        }

        let decoded;
        try {
            decoded = verifyRegistrationToken(token);
        } catch (_) {
            return res.status(401).send('Invalid or expired token');
        }

        if (decoded.scormRegId !== req.params.regId) {
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
</head>
<body>
<div id="bar">
  <span id="status">SCORM Player · Loading…</span>
  <div>
    <button type="button" id="btnSave">Save</button>
    <button type="button" id="btnExit">Exit</button>
  </div>
</div>
<iframe id="frame" title="SCORM Content" src="${escapeHtml(contentSrc)}"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  allow="autoplay"></iframe>
<script>
(function () {
  var TOKEN = '${escapeJs(token)}';
  var RUNTIME = '${escapeJs(runtimeBase)}';
  var lastError = { code: 0 };
  var statusEl = document.getElementById('status');

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
      var data = JSON.parse(xhr.responseText || '{}');
      if (data.errorCode != null) lastError.code = data.errorCode;
      return data;
    } catch (e) {
      lastError.code = 101;
      return { ok: false, value: method === 'GET' ? '' : 'false', errorCode: 101 };
    }
  }

  var ERRORS = {
    0: 'No error',
    101: 'General exception',
    201: 'Invalid argument error',
    301: 'Not initialized',
    351: 'Not implemented error',
    391: 'Not initialized error',
    402: 'Invalid set value, element is a keyword',
    403: 'Element is read only',
    404: 'Element is write only',
    405: 'Incorrect data type'
  };

  // SCORM 1.2 LMS API (must be on this window so iframe parent walk finds it)
  window.API = {
    LMSInitialize: function () {
      var d = syncCall('POST', RUNTIME + '/initialize', {});
      lastError.code = d.errorCode != null ? d.errorCode : (d.ok === false ? 101 : 0);
      if (d.ok !== false) statusEl.textContent = 'SCORM Player · ' + (d.entry === 'resume' ? 'Resumed' : 'Started');
      return d.ok === false ? 'false' : 'true';
    },
    LMSFinish: function () {
      var d = syncCall('POST', RUNTIME + '/finish', {});
      lastError.code = d.errorCode != null ? d.errorCode : 0;
      statusEl.textContent = 'SCORM Player · ' + (d.summary && d.summary.lessonStatus ? d.summary.lessonStatus : 'Finished');
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
    LMSCommit: function () {
      var d = syncCall('POST', RUNTIME + '/commit', {});
      if (d.summary && d.summary.lessonStatus) {
        statusEl.textContent = 'SCORM Player · ' + d.summary.lessonStatus;
      }
      return d.ok === false ? 'false' : 'true';
    },
    LMSGetLastError: function () { return String(lastError.code || 0); },
    LMSGetErrorString: function (code) { return ERRORS[Number(code)] || 'Unknown error'; },
    LMSGetDiagnostic: function (code) { return window.API.LMSGetErrorString(code); }
  };

  // SCORM 2004-style alias (partial — maps to 1.2 runtime)
  window.API_1484_11 = {
    Initialize: function (p) { return window.API.LMSInitialize(p); },
    Terminate: function (p) { return window.API.LMSFinish(p); },
    GetValue: function (el) { return window.API.LMSGetValue(el); },
    SetValue: function (el, v) { return window.API.LMSSetValue(el, v); },
    Commit: function (p) { return window.API.LMSCommit(p); },
    GetLastError: function () { return window.API.LMSGetLastError(); },
    GetErrorString: function (c) { return window.API.LMSGetErrorString(c); },
    GetDiagnostic: function (c) { return window.API.LMSGetDiagnostic(c); }
  };

  document.getElementById('btnSave').onclick = function () {
    try { window.API.LMSCommit(''); } catch (e) {}
  };
  document.getElementById('btnExit').onclick = function () {
    try { window.API.LMSFinish(''); } catch (e) {}
    if (window.history.length > 1) window.history.back();
    else window.close();
  };

  statusEl.textContent = 'SCORM Player · Ready';
})();
</script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(html);
    } catch (err) {
        res.status(500).send('Player error: ' + (err.message || 'unknown'));
    }
});

module.exports = router;
