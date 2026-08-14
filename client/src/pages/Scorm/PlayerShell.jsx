import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, BookOpen } from 'lucide-react';
import { apiUrl } from '../../config';
import './scormEditorialTheme.css';
import './scormContrastPolish.css';

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
      <div className="w-full max-w-3xl scorm-soft-card overflow-hidden grid grid-cols-1 md:grid-cols-[.42fr_.58fr]">
        <div className="scorm-tint-blue p-6 md:p-8 border-b md:border-b-0 md:border-r border-[#223a59] flex flex-col justify-between min-h-[230px]">
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#0e2039] border border-[#2a4b74] grid place-items-center text-[#bfdbfe]">
              <BookOpen size={20} />
            </div>
            <div className="mt-6 text-[11px] font-semibold text-[#93a4bb]">SCORM World</div>
            <div className="mt-1 text-2xl md:text-[30px] font-semibold tracking-[-0.04em] leading-tight text-[#f8fafc]">
              Your course is opening in a separate window.
            </div>
          </div>
          <div className="mt-8 text-[10px] text-[#71839c]">Registration {registrationId}</div>
        </div>

        <div className="bg-[#08111e] p-6 md:p-10 flex flex-col justify-center">
          <div className="text-[11px] font-semibold text-[#93a4bb] mb-1">Course launcher</div>
          <h1 className="text-2xl md:text-[32px] font-semibold tracking-[-0.04em] leading-tight mb-3">
            {error ? 'We could not open the course' : opened ? 'Course opened' : 'Opening your course'}
          </h1>
          <p className="text-sm leading-relaxed mb-6">
            {error || (opened
              ? 'Continue in the course window. Your progress will be saved as you move through the learning.'
              : 'Your learning experience is being prepared. If no window appears, allow popups for this site and try again.')}
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="scorm-button-secondary px-4 py-2.5 font-semibold text-xs inline-flex items-center gap-2"
            >
              <ArrowLeft size={14} /> Go back
            </button>
            {opened && !error && (
              <div className="px-4 py-2.5 rounded-xl bg-[#0b2a24] border border-[#1d6e55] text-[#a7f3d0] text-xs font-semibold inline-flex items-center gap-2">
                <ExternalLink size={14} /> Open in new window
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
