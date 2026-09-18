import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { FEEDBACK_EVENT } from '../utils/clipboard';

export default function ClipboardFeedback() {
  const [notice, setNotice] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const show = (event) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setNotice({
        type: event.detail?.type === 'error' ? 'error' : 'success',
        message: event.detail?.message || 'Link copied.'
      });
      timerRef.current = window.setTimeout(() => setNotice(null), 2600);
    };
    window.addEventListener(FEEDBACK_EVENT, show);
    return () => {
      window.removeEventListener(FEEDBACK_EVENT, show);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!notice) return null;
  const success = notice.type === 'success';

  return (
    <div
      role={success ? 'status' : 'alert'}
      aria-live={success ? 'polite' : 'assertive'}
      className="fixed left-1/2 bottom-5 -translate-x-1/2 z-[100000] w-[calc(100%-2rem)] max-w-sm rounded-xl border px-4 py-3 shadow-2xl flex items-center gap-3"
      style={{
        color: success ? '#d9fff9' : '#ffe4e8',
        background: success ? '#073d39' : '#4b101b',
        borderColor: success ? 'rgba(79,201,191,.75)' : 'rgba(251,113,133,.75)'
      }}
    >
      {success ? <CheckCircle2 size={19} className="shrink-0" /> : <CircleAlert size={19} className="shrink-0" />}
      <span className="text-sm font-semibold flex-1">{notice.message}</span>
      <button type="button" onClick={() => setNotice(null)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/10" aria-label="Dismiss notification"><X size={15} /></button>
    </div>
  );
}
