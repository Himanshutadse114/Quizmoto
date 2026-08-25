import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileUp, Loader2, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';
import AuthorVisual from './AuthorVisual';

const EDITORIAL_THEME_ID = 1;

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createProgressId() {
  let random = '';
  try {
    random = globalThis.crypto?.randomUUID?.() || '';
  } catch (_) {}
  if (!random) random = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `scorm-course-${random}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function publicProgress(progress) {
  const numeric = Number(progress?.percent);
  const percent = Number.isFinite(numeric) ? Math.max(1, Math.min(100, Math.round(numeric))) : 1;

  if (percent >= 100) return { percent, stage: 'Course ready', detail: 'Your finished course is ready to open.' };
  if (percent >= 92) return { percent, stage: 'Finalising course', detail: 'Saving the course and preparing it for launch.' };
  if (percent >= 80) return { percent, stage: 'Building course', detail: 'Combining content, visuals, knowledge checks and tracking.' };
  if (percent >= 55) return { percent, stage: 'Creating visuals', detail: 'Preparing the visual assets for the learning experience.' };
  if (percent >= 20) return { percent, stage: 'Creating course content', detail: 'Building the learning flow, explanations and knowledge checks.' };
  return { percent, stage: 'Preparing source material', detail: 'Organising your topic, description and source material.' };
}

function GenerationModal({ active, elapsed, progress }) {
  if (!active || typeof document === 'undefined') return null;
  const status = publicProgress(progress);

  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-[#050807]/80 backdrop-blur-md grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Course generation progress">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0d1514] shadow-2xl overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl grid place-items-center bg-[#4FC9BF]/10 border border-[#4FC9BF]/20 shrink-0">
              <Loader2 size={20} className="animate-spin text-[#7BDCD3]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[.14em] font-bold text-[#7BDCD3]">Creating your course</div>
              <h2 className="text-xl md:text-2xl font-semibold text-white mt-1">{status.stage}</h2>
              <p className="text-sm text-slate-400 mt-2">{status.detail}</p>
            </div>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-300">{status.percent}%</span>
              <span className="text-slate-500">Course progress</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[.07] overflow-hidden border border-white/[.05]">
              <div className="h-full rounded-full bg-[#4FC9BF] transition-[width] duration-500 ease-out" style={{ width: `${status.percent}%` }} />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
            <div className="text-[9px] uppercase tracking-[.12em] text-slate-500 font-bold">Elapsed</div>
            <div className="text-lg font-semibold text-white mt-1 tabular-nums">{formatDuration(elapsed)}</div>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Keep this page open while the course content, visuals and learning package are prepared in one continuous process.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function CourseGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || '';
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [busy, setBusy] = useState(false);
  const [progressId, setProgressId] = useState('');
  const [progress, setProgress] = useState({ percent: 1 });
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) navigate('/');
  }, [token, navigate]);

  useEffect(() => {
    if (!busy || !startedAt) return undefined;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [busy, startedAt]);

  useEffect(() => {
    if (!busy || !progressId || !token) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await axios.get(apiUrl(`/api/scorm/author/progress/${encodeURIComponent(progressId)}`), {
          headers,
          timeout: 10000
        });
        if (!cancelled && res.data?.progress) setProgress({ percent: res.data.progress.percent });
      } catch (_) {
        // The progress record can briefly be unavailable before the generation
        // request registers it. The generation request itself remains authoritative.
      }
    };
    poll();
    const timer = window.setInterval(poll, 900);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [busy, progressId, token, headers]);

  if (editId) return <AuthorVisual />;

  const hasSource = Boolean(file || topic.trim() || description.trim());

  const generateCourse = async () => {
    if (!hasSource || busy) return;
    setError('');
    const id = createProgressId();
    setProgressId(id);
    setProgress({ percent: 1 });
    setStartedAt(Date.now());
    setElapsed(0);
    setBusy(true);

    try {
      const fileBase64 = file ? await toBase64(file) : '';
      const res = await axios.post(apiUrl('/api/scorm/author/generate'), {
        progressId: id,
        topic: topic.trim(),
        description: description.trim(),
        fileBase64,
        mimeType: file?.type || '',
        detailLevel,
        templateId: EDITORIAL_THEME_ID
      }, { headers, timeout: 480000 });

      if (res.data?.errorMessage || (res.data?.status && res.data.status !== 'ready')) {
        throw new Error(res.data?.errorMessage || `Course generation finished with status: ${res.data.status}.`);
      }

      const courseId = res.data?.courseId;
      if (courseId) navigate(`/scorm/courses/${courseId}`);
      else navigate('/scorm/courses');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Course generation failed. Please try again.');
      setBusy(false);
      setProgressId('');
      setStartedAt(0);
    }
  };

  return (
    <div className="min-h-screen max-w-[1100px] mx-auto p-4 md:p-7 pb-24 relative">
      <div className="mb-7">
        <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Course Builder</div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">Create a course</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">
          Add a topic, learning goal or source file. The complete course, visuals, knowledge checks and learner package are created together in one process.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      <section className="scorm-panel rounded-3xl border p-5 md:p-7 max-w-3xl">
        <div className="text-sm font-semibold text-white mb-5">Course source</div>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Phishing Awareness" className="w-full p-3 text-sm rounded-xl" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Description or learning goals</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe what learners should understand and be able to do after completing the course." className="w-full p-3 text-sm rounded-xl" />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.025] px-4 py-4 text-sm text-slate-400 cursor-pointer hover:bg-white/[.04] transition-colors">
            <FileUp size={18} className="text-[#7BDCD3]" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-300 truncate">{file ? file.name : 'Upload source file (optional)'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Use a policy, PDF, presentation or other supported source material.</div>
            </div>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>

          <div>
            <div className="text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Course depth</div>
            <div className="flex gap-2 flex-wrap">
              {[
                ['concise', 'Concise'],
                ['detailed', 'Detailed'],
                ['comprehensive', 'Comprehensive']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDetailLevel(value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${detailLevel === value ? 'bg-white text-black border-white' : 'border-white/15 text-white/60 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button type="button" onClick={generateCourse} disabled={busy || !hasSource} className="scorm-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              Generate course
            </button>
          </div>
        </div>
      </section>

      <GenerationModal active={busy} elapsed={elapsed} progress={progress} />
    </div>
  );
}
