import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../../config';

/**
 * SCORM 1.2 player shell.
 * Injects window.API (LMS API) for the SCO iframe.
 * Content URL keeps the registration token in the *path* so relative
 * scripts/CSS (scormdriver.js, etc.) stay authorized (no 401).
 */
export default function ScormPlayerShell() {
  const { registrationId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const tokenParam = search.get('token') || '';
  const packageIdParam = search.get('packageId') || '';
  const entryHrefParam = search.get('entryHref') || '';

  const [token, setToken] = useState(tokenParam);
  const [packageId, setPackageId] = useState(packageIdParam);
  const [entryHref, setEntryHref] = useState(entryHrefParam);
  const [status, setStatus] = useState('Initializing…');
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const lastError = useRef({ code: 0 });
  const iframeRef = useRef(null);

  const apiBase = useMemo(
    () => apiUrl(`/api/scorm/runtime/${registrationId}`),
    [registrationId]
  );

  useEffect(() => {
    if (!token || !packageId) {
      try {
        const raw = sessionStorage.getItem(`scorm_reg_${registrationId}`);
        if (raw) {
          const data = JSON.parse(raw);
          if (!token && data.token) setToken(data.token);
          if (!packageId && data.packageId) setPackageId(data.packageId);
          if (!entryHref && data.entryHref) setEntryHref(data.entryHref);
        }
      } catch (_) {}
    }
  }, [registrationId]);

  useEffect(() => {
    if (!token) {
      setError('Missing registration token. Open the invite link again.');
      return;
    }
    if (!packageId || !entryHref) {
      setError('Missing package entry. Re-open from invite or preview.');
      return;
    }

    const syncCall = (method, path, body) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(method, path, false);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (method !== 'GET') {
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(body ? JSON.stringify(body) : '{}');
        } else {
          xhr.send(null);
        }
        const data = JSON.parse(xhr.responseText || '{}');
        if (data.errorCode != null) lastError.current.code = data.errorCode;
        return data;
      } catch (e) {
        lastError.current.code = 101;
        return { ok: false, value: method === 'GET' ? '' : 'false', errorCode: 101 };
      }
    };

    window.API = {
      LMSInitialize: (_param) => {
        const d = syncCall('POST', `${apiBase}/initialize`, {});
        lastError.current.code = d.errorCode != null ? d.errorCode : d.ok === false ? 101 : 0;
        if (d.ok !== false) setStatus(d.entry === 'resume' ? 'Resumed' : 'Started');
        return d.ok === false ? 'false' : 'true';
      },
      LMSFinish: (_param) => {
        const d = syncCall('POST', `${apiBase}/finish`, {});
        lastError.current.code = d.errorCode != null ? d.errorCode : 0;
        if (d.summary?.lessonStatus) setStatus(d.summary.lessonStatus);
        else setStatus('Finished');
        return d.ok === false ? 'false' : 'true';
      },
      LMSGetValue: (el) => {
        const d = syncCall('GET', `${apiBase}/get?el=${encodeURIComponent(el || '')}`);
        return d.value != null ? String(d.value) : '';
      },
      LMSSetValue: (el, v) => {
        const d = syncCall('POST', `${apiBase}/set`, { element: el, value: v });
        return d.ok === false ? 'false' : 'true';
      },
      LMSCommit: (_param) => {
        const d = syncCall('POST', `${apiBase}/commit`, {});
        if (d.summary?.lessonStatus) setStatus(d.summary.lessonStatus);
        return d.ok === false ? 'false' : 'true';
      },
      LMSGetLastError: () => String(lastError.current.code || 0),
      LMSGetErrorString: (code) => {
        const map = {
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
        return map[Number(code)] || 'Unknown error';
      },
      LMSGetDiagnostic: (code) => window.API.LMSGetErrorString(code)
    };

    window.API_1484_11 = {
      Initialize: (p) => window.API.LMSInitialize(p),
      Terminate: (p) => window.API.LMSFinish(p),
      GetValue: (el) => window.API.LMSGetValue(el),
      SetValue: (el, v) => window.API.LMSSetValue(el, v),
      Commit: (p) => window.API.LMSCommit(p),
      GetLastError: () => window.API.LMSGetLastError(),
      GetErrorString: (c) => window.API.LMSGetErrorString(c),
      GetDiagnostic: (c) => window.API.LMSGetDiagnostic(c)
    };

    setReady(true);
    setStatus('Ready');

    return () => {
      try {
        delete window.API;
        delete window.API_1484_11;
      } catch (_) {}
    };
  }, [token, packageId, entryHref, apiBase]);

  // Token in the PATH (not query) so relative SCO assets stay under /t/<token>/...
  const contentSrc = useMemo(() => {
    if (!entryHref || !token) return null;
    const path = String(entryHref).replace(/^\/+/, '');
    const tok = encodeURIComponent(token);
    return apiUrl(`/api/scorm/content/t/${tok}/${path}`);
  }, [entryHref, token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
        <div className="max-w-md text-center rounded-2xl bg-white/5 border border-white/10 p-8">
          <h1 className="text-xl font-black mb-2">Cannot launch course</h1>
          <p className="text-white/60 text-sm mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-white/10 font-bold text-sm">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-quizmoto-darkPurple z-50">
      <header className="flex items-center justify-between gap-3 px-3 py-2 bg-black/40 border-b border-white/10 shrink-0">
        <div className="text-xs font-bold text-white/70 truncate">SCORM Player · {status}</div>
        <div className="flex gap-2">
          <button
            onClick={() => { try { window.API?.LMSCommit?.(''); } catch (_) {} }}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20"
          >
            Save
          </button>
          <button
            onClick={() => {
              try { window.API?.LMSFinish?.(''); } catch (_) {}
              navigate(-1);
            }}
            className="px-3 py-1.5 rounded-lg bg-quizmoto-red/80 text-[10px] font-black uppercase tracking-widest"
          >
            Exit
          </button>
        </div>
      </header>

      <div className="flex-1 relative bg-black">
        {ready && contentSrc ? (
          <iframe
            ref={iframeRef}
            title="SCORM Content"
            src={contentSrc}
            className="absolute inset-0 w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            allow="autoplay"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
            Loading content…
          </div>
        )}
      </div>
    </div>
  );
}
