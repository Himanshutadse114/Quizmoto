import React from 'react';
import { MonitorUp } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function WebsitePreviewLauncher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const inHostWorkspace = pathname === '/dashboard';
  const inScormAdmin = pathname === '/scorm' || (
    pathname.startsWith('/scorm/') &&
    !pathname.startsWith('/scorm/learn/') &&
    !pathname.startsWith('/scorm/player/')
  );

  if (!inHostWorkspace && !inScormAdmin) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/website-preview')}
      title="Open internal website preview"
      className="fixed z-[120] right-4 bottom-4 md:right-6 md:bottom-6 inline-flex items-center gap-2 rounded-full border-2 border-black bg-[#AAFDC0] px-4 py-3 text-[11px] font-black tracking-[-0.01em] text-black shadow-[5px_5px_0_#000] transition-transform hover:-translate-y-1 active:translate-y-0 active:shadow-[2px_2px_0_#000]"
    >
      <MonitorUp size={16} strokeWidth={2.4} />
      WEBSITE PREVIEW
    </button>
  );
}
