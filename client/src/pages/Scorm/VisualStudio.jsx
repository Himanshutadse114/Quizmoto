import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  Layers3,
  Loader2,
  PencilLine,
  Search
} from 'lucide-react';
import { apiUrl } from '../../config';

const Metric = ({ label, value, icon: Icon }) => (
  <div className="scorm-course-metric rounded-xl border p-4 md:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="scorm-display text-2xl md:text-[30px] leading-none">{value}</div>
        <div className="scorm-micro mt-2 text-[9px] uppercase font-bold">{label}</div>
      </div>
      <div className="scorm-course-metric-icon w-9 h-9 rounded-lg border grid place-items-center">
        <Icon size={16} />
      </div>
    </div>
  </div>
);

export default function VisualStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const packageId = searchParams.get('edit') || '';
  const [packages, setPackages] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

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

  const editablePackages = useMemo(
    () => packages.filter((item) => item.source === 'ai_author' && item.status !== 'deleted'),
    [packages]
  );

  const filteredPackages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return editablePackages.filter((item) => {
      if (status !== 'all' && String(item.status || '').toLowerCase() !== status) return false;
      if (!q) return true;
      return `${item.title || ''} ${item.standard || ''} ${item.status || ''}`.toLowerCase().includes(q);
    });
  }, [editablePackages, query, status]);

  const readyCount = editablePackages.filter((item) => item.status === 'ready').length;
  const otherCount = editablePackages.length - readyCount;

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-7xl mx-auto relative z-10 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7 pb-7 border-b border-white/10">
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold text-slate-500">Content management</div>
          <h2 className="scorm-display text-[42px] md:text-[56px] mt-2">Course Content Editor</h2>
          <p className="text-sm mt-3 leading-relaxed max-w-2xl">
            Update learner-visible text, slide titles, key points and knowledge checks while keeping the generated course layout and visuals intact.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/scorm/courses')}
          className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold"
        >
          <BookOpen size={15} /> My Courses
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Metric label="Editable courses" value={editablePackages.length} icon={Layers3} />
        <Metric label="Ready to edit" value={readyCount} icon={CheckCircle2} />
        <Metric label="Other status" value={otherCount} icon={FileText} />
      </div>

      <section className="scorm-course-list-shell rounded-xl overflow-hidden border">
        <div className="scorm-course-toolbar p-4 md:p-5 border-b flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div>
            <div className="scorm-micro text-[9px] uppercase font-semibold text-slate-500">Editable generated courses</div>
            <div className="mt-1 text-sm font-semibold">Choose a course to edit</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center lg:min-w-[560px]">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8295ae]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses"
                className="scorm-course-search w-full pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="min-w-[150px] px-3 py-2.5 text-xs"
              aria-label="Filter courses by status"
            >
              <option value="all">All statuses</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <div className="scorm-course-rows divide-y">
          {busy ? (
            <div className="min-h-[220px] grid place-items-center text-slate-400">
              <div className="text-center">
                <Loader2 size={22} className="animate-spin mx-auto" />
                <div className="text-xs mt-3">Loading courses…</div>
              </div>
            </div>
          ) : editablePackages.length === 0 ? (
            <div className="p-10 text-center">
              <FileText size={24} className="mx-auto text-[#8295ae] mb-3" />
              <div className="text-sm font-semibold">No editable courses yet</div>
              <div className="text-xs text-[#8295ae] mt-1">Create a generated course first, then return here to edit its learner-visible content.</div>
              <button type="button" onClick={() => navigate('/scorm/author')} className="scorm-button-primary mt-4 px-4 py-2.5 text-xs font-semibold">Create course</button>
            </div>
          ) : filteredPackages.length === 0 ? (
            <div className="p-10 text-center">
              <Search size={23} className="mx-auto text-[#8295ae] mb-3" />
              <div className="text-sm font-semibold">No courses match this view</div>
              <div className="text-xs text-[#8295ae] mt-1">Try a different search term or status filter.</div>
            </div>
          ) : (
            filteredPackages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/scorm/author?edit=${encodeURIComponent(item.id)}`)}
                className="scorm-course-row w-full text-left grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_.55fr_.55fr_auto] gap-4 items-center px-5 md:px-6 py-5 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="scorm-course-metric-icon w-10 h-10 rounded-lg border grid place-items-center shrink-0">
                    <PencilLine size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] truncate">{item.title || 'Untitled course'}</div>
                    <div className="scorm-micro text-[9px] text-[#8295ae] mt-1">Edit titles, learner text, key points and knowledge checks</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold">{String(item.standard || 'SCORM 1.2').replace(/_/g, ' ')}</div>
                  <div className="scorm-micro text-[8px] uppercase text-[#8295ae] mt-1">Standard</div>
                </div>
                <div>
                  <span className={`scorm-course-status scorm-micro inline-flex px-2 py-1 rounded-md text-[8px] uppercase font-semibold border ${item.status === 'ready' ? 'is-published' : 'is-draft'}`}>
                    {item.status || 'ready'}
                  </span>
                  <div className="scorm-micro text-[8px] uppercase text-[#8295ae] mt-1">Status</div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  Edit <ChevronRight size={16} />
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
