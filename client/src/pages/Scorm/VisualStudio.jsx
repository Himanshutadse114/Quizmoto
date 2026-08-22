import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, FileText, Loader2, PencilLine } from 'lucide-react';
import { apiUrl } from '../../config';

export default function VisualStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const packageId = searchParams.get('edit') || '';
  const [packages, setPackages] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    if (packageId) return;
    setBusy(true);
    setError('');
    axios.get(apiUrl('/api/scorm/packages'), { headers })
      .then((response) => setPackages(Array.isArray(response.data) ? response.data : []))
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setBusy(false));
  }, [token, headers, navigate, packageId]);

  if (packageId) {
    return <Navigate to={`/scorm/author?edit=${encodeURIComponent(packageId)}`} replace />;
  }

  const editablePackages = packages.filter((item) => item.source === 'ai_author' && item.status !== 'deleted');

  return (
    <div className="min-h-screen p-4 md:p-7 max-w-[1200px] mx-auto relative z-10 pb-24">
      <div className="mb-7">
        <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">SCORM AI</div>
        <h1 className="text-3xl md:text-[38px] font-semibold tracking-[-.04em] mt-1">Course Content Editor</h1>
        <p className="text-sm mt-2 max-w-2xl text-slate-400">Edit the written content of an AI-generated course without exposing visual layout controls. Full visual QA stays in the course workspace through Preview course.</p>
      </div>

      {error && <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <section className="scorm-panel rounded-3xl border overflow-hidden">
        <div className="p-5 md:p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold">AI-generated courses</div>
            <h2 className="text-lg font-semibold text-white mt-1">Choose a course to edit</h2>
          </div>
          <button type="button" onClick={() => navigate('/scorm/courses')} className="scorm-button-secondary inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold"><BookOpen size={14} /> My Courses</button>
        </div>

        <div className="p-4 md:p-6">
          {busy ? (
            <div className="min-h-[220px] grid place-items-center text-slate-400">
              <div className="text-center"><Loader2 size={22} className="animate-spin mx-auto" /><div className="text-xs mt-3">Loading courses…</div></div>
            </div>
          ) : editablePackages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[.025] p-8 text-center">
              <FileText size={24} className="mx-auto text-white/35" />
              <div className="text-sm font-semibold text-white mt-3">No AI-generated courses yet</div>
              <div className="text-xs text-slate-500 mt-1">Create a course first, then return here to edit its written content.</div>
              <button type="button" onClick={() => navigate('/scorm/author')} className="scorm-button-primary mt-4 px-4 py-2.5 text-xs font-semibold">Create AI course</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {editablePackages.map((item) => (
                <button key={item.id} type="button" onClick={() => navigate(`/scorm/author?edit=${encodeURIComponent(item.id)}`)} className="text-left rounded-2xl border border-white/10 bg-white/[.03] hover:bg-white/[.06] p-4 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 grid place-items-center shrink-0"><PencilLine size={16} className="text-white/65" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate">{item.title || 'Untitled course'}</div>
                      <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-[.08em]">{item.standard || 'SCORM 1.2'} · {item.status || 'ready'}</div>
                      <div className="text-xs text-slate-400 mt-3">Edit slide text, labels, reveal copy and knowledge checks</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
