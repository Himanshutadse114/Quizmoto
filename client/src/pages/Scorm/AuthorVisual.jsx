import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileUp,
  Loader2,
  Play,
  Wand2,
  X
} from 'lucide-react';
import { apiUrl } from '../../config';
import AuthorQuizEditor from './AuthorQuizEditor';
import { normalizeCourseSlide } from './courseExperienceV5';

const DRAFT_KEY = 'quizmoto_scorm_author_content_draft_v3';
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

function normalizeQuizQuestion(value) {
  const item = value && typeof value === 'object' ? value : {};
  const options = Array.isArray(item.options) ? [...item.options].slice(0, 4) : [];
  while (options.length < 4) options.push('');
  const correct = Number(item.correctAnswer);
  return {
    ...item,
    question: String(item.question || ''),
    options,
    correctAnswer: Number.isInteger(correct) && correct >= 0 && correct < 4 ? correct : 0,
    explanation: String(item.explanation || '')
  };
}

function normalizeAnalysis(value) {
  const analysis = value && typeof value === 'object' ? value : {};
  return {
    ...analysis,
    title: analysis.title || 'Learning experience',
    summary: analysis.summary || '',
    slides: (analysis.slides || []).map(normalizeCourseSlide),
    quiz: Array.isArray(analysis.quiz) ? analysis.quiz.map(normalizeQuizQuestion) : []
  };
}

function visiblePointLimit(slide) {
  const layout = String(slide?.layout || '').trim().toLowerCase();
  if (['process', 'timeline', 'cycle', 'spotlight', 'cards', 'hub'].includes(layout)) return 4;
  return 6;
}

function cleanForGenerate(analysis) {
  if (!analysis) return null;
  const {
    coverImageAsset,
    replicateMedia,
    mediaProvider,
    ...course
  } = analysis;
  return {
    ...course,
    themeId: EDITORIAL_THEME_ID,
    themeName: 'Editorial',
    slides: (analysis.slides || []).map(({
      visualAsset,
      mobileVisualAsset,
      rasterVisualAsset,
      narrationAsset,
      narrationText,
      ...slide
    }) => ({
      ...slide,
      keyPoints: (Array.isArray(slide.keyPoints) ? slide.keyPoints : []).slice(0, visiblePointLimit(slide))
    })),
    quiz: (analysis.quiz || []).map((question) => ({
      ...question,
      question: String(question.question || '').trim(),
      options: (question.options || []).map((option) => String(option || '').trim()).slice(0, 4),
      correctAnswer: Number(question.correctAnswer),
      explanation: String(question.explanation || '').trim()
    }))
  };
}

function validateQuiz(quiz) {
  const questions = Array.isArray(quiz) ? quiz : [];
  for (let index = 0; index < questions.length; index += 1) {
    const item = questions[index] || {};
    const options = Array.isArray(item.options) ? item.options : [];
    if (!String(item.question || '').trim()) return `Knowledge check ${index + 1} needs a question.`;
    if (options.length !== 4 || options.some((option) => !String(option || '').trim())) {
      return `Knowledge check ${index + 1} needs four answer options.`;
    }
    const correct = Number(item.correctAnswer);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      return `Knowledge check ${index + 1} needs a valid correct answer.`;
    }
    if (!String(item.explanation || '').trim()) return `Knowledge check ${index + 1} needs an explanation.`;
  }
  return '';
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function createProgressId(task) {
  let random = '';
  try {
    random = globalThis.crypto?.randomUUID?.() || '';
  } catch (_) {}
  if (!random) random = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `scorm-${task}-${random}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

function progressTimeLabel(task, progress) {
  const percent = Number(progress?.percent || 0);
  const modelStatus = String(progress?.modelStatus || '').toLowerCase();
  if (modelStatus === 'starting') return 'Waiting for model';
  if (percent >= 96) return 'Almost ready';
  if (task === 'analyze') {
    if (modelStatus === 'processing') return 'Usually < 2 min';
    return 'Typical: 1–3 min';
  }
  if (percent >= 80) return 'Usually < 30 sec';
  return 'Typical: 30–90 sec';
}

function GenerationProgressModal({ task, elapsed, progress }) {
  if (!task || typeof document === 'undefined') return null;
  const numericPercent = Number(progress?.percent);
  const percent = Number.isFinite(numericPercent) ? Math.max(1, Math.min(100, Math.round(numericPercent))) : 1;
  const isAnalyze = task === 'analyze';
  const stage = progress?.stage || (isAnalyze ? 'Contacting the course-writing service' : 'Preparing final course');
  const detail = progress?.detail || (isAnalyze
    ? 'Waiting for the backend to report the current AI generation state.'
    : 'Waiting for the backend to report the current image and packaging state.');
  const modelStatus = String(progress?.modelStatus || '').trim().toLowerCase();

  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-[#050807]/80 backdrop-blur-md grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Course generation progress">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#0d1514] shadow-2xl overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl grid place-items-center bg-[#4FC9BF]/10 border border-[#4FC9BF]/20 shrink-0">
              <Loader2 size={20} className="animate-spin text-[#7BDCD3]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[.14em] font-bold text-[#7BDCD3]">{isAnalyze ? 'Creating learning content' : 'Creating final SCORM course'}</div>
              <h2 className="text-xl md:text-2xl font-semibold text-white mt-1">{stage}</h2>
              <p className="text-sm text-slate-400 mt-2">{detail}</p>
              {modelStatus && (
                <div className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-slate-400">
                  Replicate: {modelStatus}
                </div>
              )}
            </div>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-300">{percent}%</span>
              <span className="text-slate-500">Live backend progress</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[.07] overflow-hidden border border-white/[.05]">
              <div className="h-full rounded-full bg-[#4FC9BF] transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
              <div className="text-[9px] uppercase tracking-[.12em] text-slate-500 font-bold">Elapsed</div>
              <div className="text-lg font-semibold text-white mt-1 tabular-nums">{formatDuration(elapsed)}</div>
            </div>
            <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
              <div className="text-[9px] uppercase tracking-[.12em] text-slate-500 font-bold">Time guidance</div>
              <div className="text-lg font-semibold text-white mt-1">{progressTimeLabel(task, progress)}</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-[#4FC9BF]/[.06] border border-[#4FC9BF]/10 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
            The progress bar now follows backend and Replicate states rather than elapsed time. Cold starts can take longer, so it will stay at the current stage until the model actually moves forward.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ExactSlidePreviewModal({ src, index, total, stale, onClose }) {
  if (!src || typeof document === 'undefined') return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm p-3 md:p-6 overflow-auto" role="dialog" aria-modal="true" aria-label="Exact generated slide preview">
      <div className="max-w-[1320px] mx-auto">
        <div className="flex items-center justify-between gap-3 mb-3 text-white">
          <div>
            <div className="text-[10px] uppercase tracking-[.12em] text-white/45 font-bold">Exact generated course renderer</div>
            <div className="text-sm font-semibold mt-1">Slide {index + 1} of {total}</div>
          </div>
          <button type="button" onClick={onClose} className="scorm-button-secondary w-10 h-10 grid place-items-center" aria-label="Close preview"><X size={17} /></button>
        </div>

        {stale && (
          <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
            This preview shows the last generated course. Use Save & rebuild course to apply your current text changes to the exact learner output.
          </div>
        )}

        <div className="rounded-[18px] overflow-hidden border border-white/15 shadow-2xl bg-[#05070d] h-[78vh] min-h-[520px] max-h-[860px]">
          <iframe
            src={src}
            title={`Generated slide ${index + 1} preview`}
            className="w-full h-full border-0 block bg-[#05070d]"
            allow="fullscreen"
          />
        </div>
        <p className="text-center text-[11px] text-white/45 mt-3">This uses the same generated SCORM HTML, CSS and visual assets as the learner course. Navigation is locked to the selected slide.</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function AuthorVisual() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || '';
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [file, setFile] = useState(null);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyTask, setBusyTask] = useState('');
  const [busyStartedAt, setBusyStartedAt] = useState(0);
  const [busyProgressId, setBusyProgressId] = useState('');
  const [liveProgress, setLiveProgress] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const beginBusyTask = (task) => {
    const progressId = createProgressId(task);
    setBusy(true);
    setBusyTask(task);
    setBusyStartedAt(Date.now());
    setBusyProgressId(progressId);
    setLiveProgress({
      percent: 1,
      stage: 'Contacting course service',
      detail: 'Waiting for the backend to begin the generation request.',
      modelStatus: ''
    });
    setElapsedSeconds(0);
    return progressId;
  };

  const endBusyTask = () => {
    setBusy(false);
    setBusyTask('');
    setBusyStartedAt(0);
    setBusyProgressId('');
    setLiveProgress(null);
    setElapsedSeconds(0);
  };

  useEffect(() => {
    if (!busyTask || !busyStartedAt) return undefined;
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - busyStartedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [busyTask, busyStartedAt]);

  useEffect(() => {
    if (!busyTask || !busyProgressId || !token) return undefined;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const res = await axios.get(apiUrl(`/api/scorm/author/progress/${encodeURIComponent(busyProgressId)}`), {
          headers,
          timeout: 10000
        });
        if (!cancelled && res.data?.progress) setLiveProgress(res.data.progress);
      } catch (err) {
        // 404 is normal during the first few milliseconds before the POST route
        // has registered the progress id. Keep the initial state and retry.
        if (!cancelled && err.response?.status && err.response.status !== 404) {
          setLiveProgress((prev) => prev || {
            percent: 1,
            stage: 'Waiting for generation status',
            detail: 'The course request is still running. Live status will resume when the backend responds.'
          });
        }
      }
    };

    poll();
    timer = window.setInterval(poll, 900);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [busyTask, busyProgressId, token, headers]);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    if (editId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (stored?.analysis) {
        setAnalysis(normalizeAnalysis(stored.analysis));
        setDetailLevel(stored.detailLevel || 'detailed');
      }
    } catch (_) {}
  }, [token, navigate, editId]);

  useEffect(() => {
    if (!editId || !token) return;
    setBusy(true);
    setError('');
    axios.get(apiUrl(`/api/scorm/packages/${editId}/analysis`), { headers })
      .then((res) => {
        setAnalysis(normalizeAnalysis(res.data.analysis || {}));
        setSelected(0);
        setDirty(false);
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setBusy(false));
  }, [editId, token, headers]);

  useEffect(() => {
    if (!analysis || editId) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ analysis, detailLevel })); } catch (_) {}
  }, [analysis, detailLevel, editId]);

  const hasSource = Boolean(file || topic.trim() || description.trim());
  const slide = analysis?.slides?.[selected];
  const pointLimit = visiblePointLimit(slide);
  const visiblePoints = (slide?.keyPoints || []).slice(0, pointLimit);

  const analyze = async () => {
    if (!hasSource) {
      setError('Add a topic and description or upload a source document.');
      return;
    }
    const progressId = beginBusyTask('analyze');
    setError('');
    setNotice('');
    try {
      const fileBase64 = file ? await toBase64(file) : '';
      const res = await axios.post(apiUrl('/api/scorm/author/analyze'), {
        progressId,
        topic: topic.trim(),
        description: description.trim(),
        fileBase64,
        mimeType: file?.type || '',
        detailLevel,
        templateId: EDITORIAL_THEME_ID
      }, { headers, timeout: 360000 });
      setAnalysis(normalizeAnalysis(res.data.analysis));
      setSelected(0);
      setDirty(true);
      const provider = res.data?.aiProvider === 'replicate' ? 'Replicate' : 'AI';
      setNotice(`${provider} learning content is ready. Review and edit the learner-visible text, then generate the course. Raster images are created during final generation.`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      endBusyTask();
    }
  };

  const updateSlide = (patch) => {
    setDirty(true);
    setAnalysis((prev) => {
      if (!prev) return prev;
      const slides = [...prev.slides];
      slides[selected] = { ...slides[selected], ...patch };
      return { ...prev, slides };
    });
  };

  const updatePoint = (index, value) => {
    const points = [...(slide?.keyPoints || [])];
    points[index] = value;
    updateSlide({ keyPoints: points });
  };

  const updateQuiz = (quiz) => {
    setDirty(true);
    setAnalysis((prev) => prev ? { ...prev, quiz } : prev);
  };

  const updateCourseTitle = (value) => {
    setDirty(true);
    setAnalysis((prev) => prev ? { ...prev, title: value } : prev);
  };

  const openExactPreview = async () => {
    if (!editId) {
      setNotice('Exact slide preview is available after the course is generated because it uses the final SCORM HTML, CSS and generated visual assets.');
      return;
    }
    setPreviewBusy(true);
    setError('');
    try {
      const res = await axios.post(apiUrl(`/api/scorm/courses/${editId}/preview`), {}, { headers });
      const registrationId = res.data?.registrationId;
      const previewToken = res.data?.token;
      if (!registrationId || !previewToken) throw new Error('Preview session could not be created.');
      const query = new URLSearchParams({ token: previewToken, slide: String(selected) });
      setPreviewUrl(apiUrl(`/api/scorm/slide-preview/${registrationId}?${query.toString()}`));
      setPreviewOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setPreviewBusy(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewUrl('');
  };

  const generate = async () => {
    if (!analysis) return;
    const quizError = validateQuiz(analysis.quiz);
    if (quizError) {
      setError(quizError);
      return;
    }
    const task = editId ? 'rebuild' : 'generate';
    const progressId = beginBusyTask(task);
    setError('');
    setNotice('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/author/generate'), {
        progressId,
        analysis: cleanForGenerate(analysis),
        templateId: EDITORIAL_THEME_ID,
        ...(editId ? { replacePackageId: editId } : {})
      }, { headers, timeout: 360000 });

      if (res.data?.errorMessage || (res.data?.status && res.data.status !== 'ready')) {
        setError(res.data?.errorMessage || `Course rebuild finished with status: ${res.data.status}.`);
        return;
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      setDirty(false);
      const id = res.data?.courseId || null;
      setNotice(editId ? 'Course content rebuilt successfully.' : 'Course generated successfully.');
      if (id) navigate(`/scorm/courses/${id}`);
      else navigate('/scorm/courses');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      endBusyTask();
    }
  };

  return (
    <div className="min-h-screen max-w-[1450px] mx-auto p-4 md:p-7 pb-24 relative">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">SCORM AI · Content Editor</div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">{editId ? 'Edit course content' : 'Create AI course'}</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">Only learner-visible text is editable here. Visual layout, raster artwork and course styling are managed by the course generator. No audio is added.</p>
        </div>
        {analysis && (
          <div className="flex items-center gap-2 flex-wrap">
            {slide && editId && (
              <button type="button" onClick={openExactPreview} disabled={previewBusy} className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                {previewBusy ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Preview slide
              </button>
            )}
            {slide && !editId && (
              <button type="button" disabled title="Generate the course first to use the exact learner renderer" className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold opacity-45 cursor-not-allowed">
                <Eye size={16} /> Preview after generation
              </button>
            )}
            <button type="button" onClick={generate} disabled={busy} className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {editId ? 'Save & rebuild course' : 'Generate course'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {!analysis && (
        <section className="scorm-panel rounded-3xl border p-6 max-w-2xl">
          <div className="text-sm font-semibold text-white mb-4">Source material</div>
          <div className="space-y-3">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Course topic" className="w-full p-3 text-sm rounded-xl" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Brief description or learning goals" className="w-full p-3 text-sm rounded-xl" />
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <FileUp size={16} />
              <span>{file ? file.name : 'Upload policy / source (optional)'}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex gap-2 flex-wrap">
              {['concise', 'detailed', 'comprehensive'].map((level) => (
                <button key={level} type="button" onClick={() => setDetailLevel(level)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${detailLevel === level ? 'bg-white text-black border-white' : 'border-white/15 text-white/60'}`}>{level}</button>
              ))}
            </div>
            <button type="button" onClick={analyze} disabled={busy || !hasSource} className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              Build learning content
            </button>
          </div>
        </section>
      )}

      {analysis && slide && (
        <div className="space-y-6">
          <div className="grid xl:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
            <aside className="scorm-panel rounded-2xl border p-2 xl:sticky xl:top-24 max-h-[76vh] overflow-auto">
              <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold px-2 py-2">Slides</div>
              {analysis.slides.map((item, index) => (
                <button key={index} type="button" onClick={() => setSelected(index)} className={`w-full text-left rounded-xl px-3 py-2.5 mb-1 border ${selected === index ? 'bg-[#122541] border-[#315a8b]' : 'border-transparent hover:bg-[#0d1928]'}`}>
                  <div className="text-[9px] uppercase tracking-[.1em] text-slate-500">Slide {String(index + 1).padStart(2, '0')}</div>
                  <div className="text-xs font-semibold truncate mt-0.5">{item.title || 'Untitled slide'}</div>
                </button>
              ))}
            </aside>

            <main className="min-w-0 space-y-4">
              <section className="scorm-panel rounded-3xl border overflow-hidden">
                <div className="p-4 md:p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold">Course title</div>
                    <input value={analysis.title || ''} onChange={(e) => updateCourseTitle(e.target.value)} className="mt-1 w-full bg-transparent border-0 outline-none text-xl font-semibold text-white px-3 py-2.5 min-h-[46px]" placeholder="Course title" />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button type="button" disabled={selected === 0} onClick={() => setSelected((value) => Math.max(0, value - 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30" aria-label="Previous slide"><ChevronLeft size={16} /></button>
                    <button type="button" disabled={selected >= analysis.slides.length - 1} onClick={() => setSelected((value) => Math.min(analysis.slides.length - 1, value + 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30" aria-label="Next slide"><ChevronRight size={16} /></button>
                    {editId ? (
                      <button type="button" onClick={openExactPreview} disabled={previewBusy} className="scorm-button-secondary inline-flex items-center gap-2 px-3 py-2.5 text-xs font-semibold disabled:opacity-50">
                        {previewBusy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview slide
                      </button>
                    ) : (
                      <button type="button" disabled title="Generate the course first to use the exact learner renderer" className="scorm-button-secondary inline-flex items-center gap-2 px-3 py-2.5 text-xs font-semibold opacity-45 cursor-not-allowed"><Eye size={14} /> Preview after generation</button>
                    )}
                  </div>
                </div>

                <div className="p-4 md:p-6 space-y-5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Slide title</label>
                    <textarea rows={2} value={slide.title || ''} onChange={(e) => updateSlide({ title: e.target.value })} className="w-full p-3 text-base font-semibold leading-snug" placeholder="Slide title" />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Learner text</label>
                    <textarea rows={5} value={slide.introText || ''} onChange={(e) => updateSlide({ introText: e.target.value })} className="w-full p-3 text-sm leading-relaxed" placeholder="Main text shown on this learner slide" />
                  </div>

                  {!!visiblePoints.length && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Visible key points</label>
                      <div className="grid md:grid-cols-2 gap-2.5">
                        {visiblePoints.map((point, index) => (
                          <div key={index} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                            <div className="text-[9px] uppercase tracking-[.1em] text-slate-600 font-bold mb-1.5">Point {index + 1}</div>
                            <textarea rows={2} value={point || ''} onChange={(e) => updatePoint(index, e.target.value)} className="w-full p-2.5 text-sm leading-snug" placeholder={`Point ${index + 1}`} />
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-2">This layout renders up to {pointLimit} key points in the learner course. Only those visible points are editable here.</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Visual title</label>
                    <input value={slide.visualTitle || ''} onChange={(e) => updateSlide({ visualTitle: e.target.value })} className="w-full p-3 text-sm" placeholder="Short text shown inside the visual" />
                  </div>
                </div>
              </section>
            </main>
          </div>

          <section className="scorm-panel rounded-3xl border p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-white">Knowledge checks</h2>
              <p className="text-[11px] text-slate-500 mt-1">Edit question text, answer options, correct answers and explanations. Visual course settings are not exposed here.</p>
            </div>
            <AuthorQuizEditor quiz={analysis.quiz || []} onChange={updateQuiz} />
          </section>
        </div>
      )}

      {previewOpen && previewUrl && (
        <ExactSlidePreviewModal
          src={previewUrl}
          index={selected}
          total={analysis?.slides?.length || 1}
          stale={dirty}
          onClose={closePreview}
        />
      )}

      <GenerationProgressModal
        task={busyTask}
        elapsed={elapsedSeconds}
        progress={liveProgress}
      />
    </div>
  );
}
