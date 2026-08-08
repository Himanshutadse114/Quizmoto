import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../../config';
import './scormEditorialTheme.css';

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
      window.location.replace(url);
      return;
    }

    try {
      win.focus();
    } catch (_) {}
    setOpened(true);
  }, [registrationId, search]);

  return (
    <div className="scorm-editorial min-h-screen flex items-center justify-center p-4 md:p-8 relative z-20">
      <div className="w-full max-w-3xl border-2 border-[#111111] grid grid-cols-1 md:grid-cols-[.42fr_.58fr]">
        <div className="bg-[#111111] text-[#F4F0E6] p-6 md:p-8 border-b-2 md:border-b-0 md:border-r-2 border-[#111111] flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em]">SCORM World</div>
            <div className="text-5xl md:text-6xl font-black uppercase tracking-[-0.06em] leading-[0.85] mt-5">Learn.<br />Track.<br />Finish.</div>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] mt-8">Registration / {registrationId}</div>
        </div>

        <div className="p-6 md:p-10 flex flex-col justify-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-3">Course launcher</div>
          <h1 className="text-3xl md:text-4xl font-black uppercase leading-[0.95] mb-5">
            {error ? 'Cannot launch course.' : opened ? 'Course opened.' : 'Opening course.'}
          </h1>
          <div className="border-t-2 border-[#111111] pt-5">
            <p className="text-sm font-semibold leading-relaxed mb-6">
              {error || (opened
                ? 'Use the course window to continue learning. You can keep this page open or return to the previous screen.'
                : 'Your learning experience is being prepared. If no window appears, allow popups for this site and try again.')}
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="scorm-button-primary px-5 py-3 font-black text-xs uppercase tracking-[0.12em]"
            >
              ← Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
