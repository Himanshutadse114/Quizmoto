import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../../config';

/**
 * Opens the same-origin backend player in a popup window so the host/learner
 * dashboard stays available. Falls back to same-tab navigation if popups blocked.
 */
export default function ScormPlayerShell() {
  const { registrationId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let token = search.get('token') || '';
    let entryHref = search.get('entryHref') || '';
    let packageId = search.get('packageId') || '';

    if (!token || !entryHref) {
      try {
        const raw = sessionStorage.getItem(`scorm_reg_${registrationId}`);
        if (raw) {
          const data = JSON.parse(raw);
          if (!token && data.token) token = data.token;
          if (!entryHref && data.entryHref) entryHref = data.entryHref;
          if (!packageId && data.packageId) packageId = data.packageId;
        }
      } catch (_) {}
    }

    if (!token) {
      setError('Missing registration token. Open the invite link again.');
      return;
    }
    if (!entryHref) {
      setError('Missing package entry. Re-open from invite or preview.');
      return;
    }

    const q = new URLSearchParams({
      token,
      entryHref,
      packageId: packageId || ''
    });
    const url = apiUrl(`/api/scorm/play/${registrationId}?${q.toString()}`);

    const features =
      'popup=yes,width=1280,height=800,left=80,top=40,menubar=no,toolbar=no,location=yes,status=yes,resizable=yes,scrollbars=yes';
    const win = window.open(url, `quizmoto_scorm_${registrationId}`, features);

    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Popup blocked — same-tab fallback
      window.location.replace(url);
      return;
    }

    try {
      win.focus();
    } catch (_) {}
    setOpened(true);
  }, [registrationId, search]);

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
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
      <div className="max-w-md text-center rounded-2xl bg-white/5 border border-white/10 p-8">
        <h1 className="text-xl font-black mb-2">
          {opened ? 'Course opened in a new window' : 'Opening course…'}
        </h1>
        <p className="text-white/60 text-sm mb-4">
          {opened
            ? 'Use the popup player to take the course. You can close this tab or go back to the dashboard.'
            : 'If nothing opens, allow popups for this site and try again.'}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl bg-quizmoto-blue font-black text-sm"
        >
          Back
        </button>
      </div>
    </div>
  );
}
