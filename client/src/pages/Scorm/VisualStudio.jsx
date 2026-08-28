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
  Palette,
  PencilLine,
  Search,
  X
} from 'lucide-react';
import { apiUrl } from '../../config';

const COURSE_THEMES = [
  { id: 'neutral', name: 'Neutral', primary: '#177E78', background: '#E7E7E4', text: '#282824' },
  { id: 'teal', name: 'Teal', primary: '#0F8C82', background: '#F2F8F7', text: '#172321' },
  { id: 'blue', name: 'Blue', primary: '#2563EB', background: '#F3F6FB', text: '#172033' },
  { id: 'orange', name: 'Orange', primary: '#EA6A12', background: '#FBF6F1', text: '#2D231D' },
  { id: 'purple', name: 'Purple', primary: '#7C3AED', background: '#F7F4FB', text: '#271F31' },
  { id: 'forest', name: 'Forest', primary: '#2F855A', background: '#F3F8F3', text: '#1E2A22' }
];

function progressId() {
  let value = '';
  try { value = globalThis.crypto?.randomUUID?.() || ''; } catch (_) {}
  if (!value) value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `scorm-theme-${value}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

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

function ThemeModal({ course, value, loading, saving, onChange, onClose, onSave }) {
  if (!course) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Course colour theme">
      <div className="w-full max-w-2xl scorm-panel rounded-2xl border overflow-hidden shadow-2xl">
        <div className="p-5 md:p-6 border-b flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="scorm-micro text-[9px] uppercase font-semibold">Course appearance</div>
            <h2 className="text-xl font-semibold mt-1">Choose a colour theme</h2>
            <p className="text-xs mt-1.5 max-w-xl">Change the learner-course colours after creation. Existing text, questions and generated images stay exactly the same.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="scorm-button-secondary w-10 h-10 grid place-items-center shrink-0" aria-label="Close theme settings"><X size={16} /></button>
        </div>

        <div className="p-5 md:p-6">
          <div className="text-sm font-semibold truncate mb-4">{course.title || 'Untitled course'}</div>
          {loading ? (
            <div className="min-h-[180px] grid place-items-center">
              <div className="text-center text-sm opacity-70"><Loader2 size={20} className="animate-spin mx-auto mb-2" />Loading current theme…</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {COURSE_THEMES.map((theme) => {
                const selected = value === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onChange(theme.id)}
                    disabled={saving}
                    className="text-left rounded-xl border p-3.5 transition-all"
                    style={{ borderColor: selected ? 'var(--scorm-accent)' : 'var(--scorm-line)', background: selected ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)' }}
                  >
                    <div className="h-16 rounded-lg border overflow-hidden flex" style={{ borderColor: 'var(--scorm-line)', background: theme.background }}>
                      <div className="w-1/3 h-full" style={{ background: theme.primary }} />
                      <div className="flex-1 p-2">
                        <div className="h-2 rounded-full w-4/5" style={{ background: theme.text, opacity: 0.9 }} />
                        <div className="h-1.5 rounded-full w-3/5 mt-2" style={{ background: theme.text, opacity: 0.35 }} />
                        <div className="h-1.5 rounded-full w-2/3 mt-1.5" style={{ background: theme.text, opacity: 0.22 }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <span className="text-xs font-semibold">{theme.name}</span>
                      {selected && <CheckCircle2 size={15} style={{ color: 'var(--scorm-accent)' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-5 rounded-xl border px-4 py-3 text-[11px] leading-relaxed" style={{ background: 'var(--scorm-surface-soft)', borderColor: 'var(--scorm-line)', color: 'var(--scorm-muted)' }}>
            Theme changes rebuild only the SCORM styling. The existing course visuals are reused, so no new image generation is requested.
          </div>
        </div>

        <div className="p-5 border-t flex items-center justify-end gap-2" style={{ background: 'var(--scorm-surface-soft)', borderColor: 'var(--scorm-line)' }}>
          <button type="button" onClick={onClose} disabled={saving} className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold">Cancel</button>
          <button type="button" onClick={onSave} disabled={loading || saving || !value} className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Palette size={14} />}
            {saving ? 'Applying theme…' : 'Apply theme'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VisualStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const packageId = searchParams.get('edit') || '';
  const [packages, setPackages] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [themeCourse, setThemeCourse] = useState(null);
  const [themeAnalysis, setThemeAnalysis] = useState(null);
  const [themeValue, setThemeValue] = useState('neutral');
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
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

  const openTheme = async (item) => {
    setThemeCourse(item);
    setThemeAnalysis(null);
    setThemeValue('neutral');
    setThemeLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await axios.get(apiUrl(`/api/scorm/packages/${encodeURIComponent(item.id)}/analysis`), { headers });
      const analysis = response.data?.analysis || {};
      setThemeAnalysis(analysis);
      const current = String(analysis.courseTheme || 'neutral').toLowerCase();
      setThemeValue(COURSE_THEMES.some((theme) => theme.id === current) ? current : 'neutral');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load course appearance.');
      setThemeCourse(null);
    } finally {
      setThemeLoading(false);
    }
  };

  const applyTheme = async () => {
    if (!themeCourse || !themeAnalysis || !themeValue || themeSaving) return;
    setThemeSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await axios.post(apiUrl('/api/scorm/author/generate'), {
        progressId: progressId(),
        analysis: { ...themeAnalysis, courseTheme: themeValue },
        templateId: 1,
        replacePackageId: themeCourse.id
      }, { headers, timeout: 360000 });

      if (response.data?.errorMessage || (response.data?.status && response.data.status !== 'ready')) {
        throw new Error(response.data?.errorMessage || `Course theme rebuild finished with status: ${response.data.status}.`);
      }

      const themeName = COURSE_THEMES.find((theme) => theme.id === themeValue)?.name || 'Selected';
      setNotice(`${themeName} theme applied successfully. Existing course images were preserved.`);
      setThemeAnalysis((current) => current ? { ...current, courseTheme: themeValue } : current);
      setThemeCourse(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to apply the course theme.');
    } finally {
      setThemeSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-7 lg:p-9 max-w-7xl mx-auto relative z-10 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7 pb-7 border-b border-white/10">
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold text-slate-500">Content management</div>
          <h2 className="scorm-display text-[42px] md:text-[56px] mt-2">Course Content Editor</h2>
          <p className="text-sm mt-3 leading-relaxed max-w-2xl">
            Update learner-visible text, knowledge checks and the course colour theme while keeping generated visuals intact.
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
      {notice && <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Metric label="Editable courses" value={editablePackages.length} icon={Layers3} />
        <Metric label="Ready to edit" value={readyCount} icon={CheckCircle2} />
        <Metric label="Other status" value={otherCount} icon={FileText} />
      </div>

      <section className="scorm-course-list-shell rounded-xl overflow-hidden border">
        <div className="scorm-course-toolbar p-4 md:p-5 border-b flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div>
            <div className="scorm-micro text-[9px] uppercase font-semibold text-slate-500">Editable generated courses</div>
            <div className="mt-1 text-sm font-semibold">Choose a course to edit or restyle</div>
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
              <div className="text-xs text-[#8295ae] mt-1">Create a generated course first, then return here to edit its content or theme.</div>
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
              <div
                key={item.id}
                className="scorm-course-row grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_.55fr_.55fr_auto] gap-4 items-center px-5 md:px-6 py-5 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <div className="scorm-course-metric-icon w-10 h-10 rounded-lg border grid place-items-center shrink-0">
                    <PencilLine size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] truncate">{item.title || 'Untitled course'}</div>
                    <div className="scorm-micro text-[9px] text-[#8295ae] mt-1">Edit content or change the learner-course colour theme</div>
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
                <div className="flex items-center gap-2 justify-start md:justify-end">
                  <button type="button" onClick={() => openTheme(item)} disabled={item.status !== 'ready'} className="scorm-button-secondary inline-flex items-center gap-2 px-3 py-2.5 text-xs font-semibold disabled:opacity-40">
                    <Palette size={14} /> Theme
                  </button>
                  <button type="button" onClick={() => navigate(`/scorm/author?edit=${encodeURIComponent(item.id)}`)} className="scorm-button-primary inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold">
                    Edit <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <ThemeModal
        course={themeCourse}
        value={themeValue}
        loading={themeLoading}
        saving={themeSaving}
        onChange={setThemeValue}
        onClose={() => { if (!themeSaving) setThemeCourse(null); }}
        onSave={applyTheme}
      />
    </div>
  );
}
