import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Check, ChevronLeft, ChevronRight, FileUp, Loader2, Palette, Play, Sparkles, Wand2
} from 'lucide-react';
import { apiUrl } from '../../config';
import AuthorQuizEditor from './AuthorQuizEditor';
import {
  BACKGROUND_STYLES,
  COURSE_LAYOUTS,
  COURSE_THEMES,
  METAPHORS,
  SCREEN_TYPES,
  courseTheme,
  normalizeCourseSlide,
  visualFitIssues
} from './courseExperienceV5';

const DRAFT_KEY = 'quizmoto_scorm_author_visual_draft_v2';
const GAMMA_THEME_ID = 1;

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

function cleanForGenerate(analysis) {
  if (!analysis) return null;
  return {
    ...analysis,
    themeId: GAMMA_THEME_ID,
    themeName: 'Gamma Editorial',
    slides: (analysis.slides || []).map(({ visualAsset, mobileVisualAsset, ...slide }) => slide),
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
    if (options.length !== 4 || options.some((option) => !String(option || '').trim())) return `Knowledge check ${index + 1} needs four answer options.`;
    const correct = Number(item.correctAnswer);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return `Knowledge check ${index + 1} needs a valid correct answer.`;
    if (!String(item.explanation || '').trim()) return `Knowledge check ${index + 1} needs an explanation.`;
  }
  return '';
}

function LivePptCanvas({ slide, index, total, courseTitle, onChange }) {
  const theme = courseTheme(GAMMA_THEME_ID);
  const points = Array.isArray(slide?.keyPoints) ? slide.keyPoints : [];
  const issues = visualFitIssues(slide);

  return (
    <div className="w-full">
      <div
        className="relative mx-auto rounded-[18px] overflow-hidden shadow-[0_20px_60px_rgba(40,40,36,.12)] border"
        style={{
          background: theme.bg,
          borderColor: theme.accent,
          maxWidth: 980,
          minHeight: 520
        }}
      >
        <div className="h-12 px-5 flex items-center gap-3 border-b" style={{ borderColor: theme.accent, background: 'rgba(231,231,228,.96)' }}>
          <div className="w-7 h-7 rounded-md text-white text-[11px] font-black flex items-center justify-center" style={{ background: theme.primary }}>Q</div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold truncate" style={{ color: theme.primary }}>{courseTitle}</div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.body }}>
            Part {index + 1} of {total}
          </div>
          <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: theme.accent }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(8, ((index + 1) / Math.max(1, total)) * 100)}%`, background: theme.primary }} />
          </div>
        </div>

        <div className="grid md:grid-cols-[1.15fr_.85fr] gap-0 min-h-[440px]">
          <div className="p-7 md:p-9 flex flex-col justify-center">
            <div className="text-[10px] font-black uppercase tracking-[.12em] mb-2" style={{ color: theme.body }}>
              Section {index + 1} · {slide.layout || 'concept'}
            </div>
            <input
              value={slide.title || ''}
              onChange={(e) => onChange({ title: e.target.value, visualTitle: e.target.value })}
              className="w-full bg-transparent border-0 outline-none font-black leading-[1.05] tracking-tight mb-4"
              style={{ color: theme.primary, fontSize: 'clamp(28px, 3.2vw, 42px)' }}
              placeholder="Slide title — click to edit"
            />
            <textarea
              value={slide.introText || slide.content || ''}
              onChange={(e) => onChange({ introText: e.target.value, content: e.target.value })}
              rows={4}
              className="w-full bg-transparent border-0 outline-none resize-none leading-relaxed text-[15px]"
              style={{ color: theme.body }}
              placeholder="Learner-facing explanation — edit directly on the slide"
            />

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {points.map((point, i) => (
                <div
                  key={i}
                  className="rounded-lg px-3 py-2.5 border"
                  style={{ background: 'rgba(255,255,255,.35)', borderColor: theme.accent }}
                >
                  <div className="text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: theme.body }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <input
                    value={point}
                    onChange={(e) => {
                      const next = [...points];
                      next[i] = e.target.value;
                      onChange({ keyPoints: next });
                    }}
                    className="w-full bg-transparent border-0 outline-none text-[13px] font-semibold"
                    style={{ color: theme.primary }}
                    placeholder={`Point ${i + 1}`}
                  />
                </div>
              ))}
              {points.length < 6 && (
                <button
                  type="button"
                  onClick={() => onChange({ keyPoints: [...points, ''] })}
                  className="rounded-lg px-3 py-2.5 border border-dashed text-[12px] font-semibold"
                  style={{ borderColor: theme.accent, color: theme.body }}
                >
                  + Add point
                </button>
              )}
            </div>

            {issues.length > 0 && (
              <div className="mt-4 text-[11px] leading-relaxed" style={{ color: '#8B4C3E' }}>
                {issues[0]}
              </div>
            )}
          </div>

          <div
            className="relative min-h-[280px] md:min-h-full flex flex-col items-center justify-center p-6"
            style={{ background: theme.primary }}
          >
            <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 70% 20%,${theme.accent},transparent 55%)` }} />
            <div className="relative z-10 text-center">
              <div className="w-28 h-28 mx-auto rounded-2xl border-2 border-white/20 flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,.08)' }}>
                <span className="text-white/90 text-3xl font-black">{(slide.visualMetaphor || 'shield').slice(0, 1).toUpperCase()}</span>
              </div>
              <input
                value={slide.visualTitle || ''}
                onChange={(e) => onChange({ visualTitle: e.target.value })}
                className="w-full max-w-[220px] mx-auto bg-transparent border-0 outline-none text-center text-white font-bold text-sm"
                placeholder="Visual title"
              />
              <div className="text-[10px] text-white/50 mt-2 uppercase tracking-wider">{slide.visualMetaphor || 'shield'} · {slide.layout}</div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex gap-2 justify-center flex-wrap">
              <select
                value={slide.layout || 'cards'}
                onChange={(e) => onChange({ layout: e.target.value })}
                className="text-[10px] rounded-md px-2 py-1 bg-white/10 text-white border border-white/20"
              >
                {COURSE_LAYOUTS.map(([id, label]) => <option key={id} value={id} className="text-black">{label}</option>)}
              </select>
              <select
                value={slide.visualMetaphor || 'shield'}
                onChange={(e) => onChange({ visualMetaphor: e.target.value })}
                className="text-[10px] rounded-md px-2 py-1 bg-white/10 text-white border border-white/20"
              >
                {METAPHORS.map(([id, label]) => <option key={id} value={id} className="text-black">{label}</option>)}
              </select>
              <select
                value={slide.screenType || 'concept'}
                onChange={(e) => onChange({ screenType: e.target.value })}
                className="text-[10px] rounded-md px-2 py-1 bg-white/10 text-white border border-white/20"
              >
                {SCREEN_TYPES.map(([id, label]) => <option key={id} value={id} className="text-black">{label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="h-12 px-5 flex items-center justify-between border-t" style={{ borderColor: theme.accent, background: 'rgba(231,231,228,.96)' }}>
          <span className="text-[11px] font-semibold" style={{ color: theme.body }}>Previous</span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.body }}>Gamma Editorial</span>
          <span className="text-[11px] font-semibold px-3 py-1 rounded-md text-white" style={{ background: theme.primary }}>Next</span>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-500 mt-3">
        Edit title, body and points directly on the slide — this is how learners see the course.
      </p>
    </div>
  );
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
  const [themeId] = useState(GAMMA_THEME_ID);
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
    setBusy(true); setError('');
    axios.get(apiUrl(`/api/scorm/packages/${editId}/analysis`), { headers })
      .then((res) => {
        setAnalysis(normalizeAnalysis(res.data.analysis || {}));
        setSelected(0);
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setBusy(false));
  }, [editId, token, headers]);

  useEffect(() => {
    if (!analysis || editId) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ analysis, themeId: GAMMA_THEME_ID, detailLevel })); } catch (_) {}
  }, [analysis, detailLevel, editId]);

  const hasSource = Boolean(file || topic.trim() || description.trim());

  const analyze = async () => {
    if (!hasSource) { setError('Add a topic and description or upload a source document.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const fileBase64 = file ? await toBase64(file) : '';
      const res = await axios.post(apiUrl('/api/scorm/author/analyze'), {
        topic: topic.trim(),
        description: description.trim(),
        fileBase64,
        mimeType: file?.type || '',
        detailLevel,
        templateId: GAMMA_THEME_ID
      }, { headers, timeout: 180000 });
      setAnalysis(normalizeAnalysis(res.data.analysis));
      setSelected(0);
      setNotice('Learning blueprint ready. Edit slides on the live canvas, then generate the package.');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };

  const updateSlide = (patch) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      const slides = [...prev.slides];
      slides[selected] = { ...slides[selected], ...patch };
      return { ...prev, slides };
    });
  };

  const updateQuiz = (quiz) => setAnalysis((prev) => prev ? { ...prev, quiz } : prev);

  const generate = async () => {
    if (!analysis) return;
    const quizError = validateQuiz(analysis.quiz);
    if (quizError) {
      setError(quizError);
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/author/generate'), {
        analysis: cleanForGenerate(analysis),
        templateId: GAMMA_THEME_ID,
        ...(editId ? { replacePackageId: editId } : {})
      }, { headers, timeout: 180000 });
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      setNotice(editId ? 'Course rebuilt successfully.' : 'Course generated successfully.');
      const id = res.data?.courseId || res.data?.packageId || editId;
      if (id) navigate(`/scorm/courses/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };

  const slide = analysis?.slides?.[selected];
  const theme = courseTheme(GAMMA_THEME_ID);

  return (
    <div className="min-h-screen max-w-[1500px] mx-auto p-4 md:p-7 pb-24 relative z-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">SCORM AI · Course Experience V5</div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">{editId ? 'Edit course' : 'Create visual course'}</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">Edit slides on the live Gamma canvas — same look learners see. Knowledge checks stay below.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Palette size={14} className="text-white/60" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Theme</div>
              <div className="text-xs font-semibold text-white">Gamma Editorial</div>
            </div>
            <span className="w-6 h-6 rounded-md border border-white/20" style={{ background: `linear-gradient(145deg,${theme.bg},${theme.primary})` }} />
          </div>
          {analysis && (
            <button type="button" onClick={generate} disabled={busy} className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {editId ? 'Rebuild package' : 'Generate package'}
            </button>
          )}
        </div>
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
            <div className="flex gap-2">
              {['concise', 'detailed', 'comprehensive'].map((level) => (
                <button key={level} type="button" onClick={() => setDetailLevel(level)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${detailLevel === level ? 'bg-white text-black border-white' : 'border-white/15 text-white/60'}`}>{level}</button>
              ))}
            </div>
            <button type="button" onClick={analyze} disabled={busy || !hasSource} className="scorm-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              Build learning blueprint
            </button>
          </div>
        </section>
      )}

      {analysis && slide && (
        <div className="space-y-6">
          <div className="grid xl:grid-cols-[200px_minmax(0,1fr)] gap-4 items-start">
            <aside className="scorm-panel rounded-2xl border p-2 xl:sticky xl:top-24 max-h-[70vh] overflow-auto">
              <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold px-2 py-2">Slides</div>
              {analysis.slides.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 mb-1 border ${selected === i ? 'bg-[#122541] border-[#315a8b]' : 'border-transparent hover:bg-[#0d1928]'}`}
                >
                  <div className="text-[9px] uppercase tracking-[.1em] text-slate-500">{String(i + 1).padStart(2, '0')} · {item.layout}</div>
                  <div className="text-xs font-semibold truncate mt-0.5">{item.title}</div>
                </button>
              ))}
            </aside>

            <div className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={analysis.title || ''}
                  onChange={(e) => setAnalysis((prev) => prev ? { ...prev, title: e.target.value } : prev)}
                  className="flex-1 bg-transparent border-0 outline-none text-lg font-semibold text-white"
                  placeholder="Course title"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={selected === 0} onClick={() => setSelected((v) => Math.max(0, v - 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <button type="button" disabled={selected >= analysis.slides.length - 1} onClick={() => setSelected((v) => Math.min(analysis.slides.length - 1, v + 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
              </div>

              <LivePptCanvas
                slide={slide}
                index={selected}
                total={analysis.slides.length}
                courseTitle={analysis.title}
                onChange={updateSlide}
              />

              <div className="scorm-panel rounded-2xl border p-4">
                <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold mb-2">Reveal text (after interaction)</div>
                <textarea
                  rows={2}
                  value={slide.revealText || ''}
                  onChange={(e) => updateSlide({ revealText: e.target.value })}
                  className="w-full p-2.5 text-sm rounded-xl"
                  placeholder="Optional detail shown after the learner explores the slide"
                />
              </div>
            </div>
          </div>

          <section className="scorm-panel rounded-3xl border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-white/70" />
              <h2 className="text-sm font-semibold text-white">Knowledge checks</h2>
              <span className="text-[11px] text-slate-500">Edit questions below — they appear after the learning slides</span>
            </div>
            <AuthorQuizEditor quiz={analysis.quiz || []} onChange={updateQuiz} />
          </section>
        </div>
      )}
    </div>
  );
}
