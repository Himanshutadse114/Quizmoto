import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Check, ChevronLeft, ChevronRight, FileUp, Loader2, Palette, Play, Sparkles, Wand2
} from 'lucide-react';
import { apiUrl } from '../../config';
import AuthorQuizEditor from './AuthorQuizEditor';
import {
  COURSE_LAYOUTS,
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

function LiveVisualPreview({ slide, theme }) {
  const layout = slide?.layout || 'cards';
  const points = (slide?.keyPoints || []).filter(Boolean).slice(0, 6);
  const metaphor = (slide?.visualMetaphor || 'shield').slice(0, 1).toUpperCase();
  const title = slide?.visualTitle || slide?.title || 'Visual';
  const ink = '#F4F2EC';
  const card = 'rgba(244,242,236,.12)';
  const line = 'rgba(244,242,236,.22)';

  if (layout === 'hub') {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 p-5">
        <div className="w-28 h-28 rounded-full flex items-center justify-center text-center" style={{ background: `radial-gradient(circle at 32% 28%,${theme.accent},transparent 52%),linear-gradient(145deg,#3d3d38,#1c1c19)`, boxShadow: '0 18px 40px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.12)' }}>
          <div className="px-3">
            <div className="text-[8px] uppercase tracking-[.14em] mb-1" style={{ color: 'rgba(244,242,236,.55)' }}>{slide.visualMetaphor || 'hub'}</div>
            <div className="text-[12px] font-bold leading-tight" style={{ color: ink }}>{title}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
          {points.slice(0, 4).map((p, i) => (
            <div key={i} className="rounded-xl px-2.5 py-2 flex items-start gap-2" style={{ background: card, border: `1px solid ${line}` }}>
              <span className="w-5 h-5 rounded-md text-[9px] font-black flex items-center justify-center shrink-0" style={{ background: 'rgba(244,242,236,.18)', color: ink }}>{i + 1}</span>
              <span className="text-[10px] font-semibold leading-snug line-clamp-2" style={{ color: 'rgba(244,242,236,.88)' }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === 'process' || layout === 'timeline' || layout === 'cycle') {
    return (
      <div className="w-full h-full flex flex-col justify-center gap-2.5 p-5">
        {points.slice(0, 4).map((p, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full text-[12px] font-black flex items-center justify-center shrink-0" style={{ background: 'rgba(244,242,236,.16)', border: `1px solid ${line}`, color: ink }}>{i + 1}</div>
            <div className="flex-1 rounded-xl px-3 py-2" style={{ background: card, border: `1px solid ${line}` }}>
              <div className="text-[11px] font-semibold leading-snug line-clamp-2" style={{ color: 'rgba(244,242,236,.9)' }}>{p}</div>
            </div>
          </div>
        ))}
        {points.length === 0 && <div className="text-center text-[11px]" style={{ color: 'rgba(244,242,236,.4)' }}>Add key points to preview the flow</div>}
      </div>
    );
  }

  if (layout === 'comparison') {
    const half = Math.max(1, Math.ceil(points.length / 2));
    return (
      <div className="w-full h-full grid grid-cols-2 gap-2.5 p-4">
        <div className="rounded-2xl p-3" style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(52,211,153,.35)' }}>
          <div className="text-[9px] uppercase tracking-[.12em] font-bold mb-2" style={{ color: '#6EE7B7' }}>Recommended</div>
          {points.slice(0, half).map((p, i) => (
            <div key={i} className="text-[10px] mb-2 leading-snug flex gap-1.5" style={{ color: 'rgba(244,242,236,.88)' }}>
              <span style={{ color: '#34D399' }}>✓</span><span className="line-clamp-2">{p}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'rgba(244,63,94,.1)', border: '1px solid rgba(251,113,133,.35)' }}>
          <div className="text-[9px] uppercase tracking-[.12em] font-bold mb-2" style={{ color: '#FDA4AF' }}>Watch out</div>
          {(points.slice(half).length ? points.slice(half) : ['Pause and verify']).map((p, i) => (
            <div key={i} className="text-[10px] mb-2 leading-snug flex gap-1.5" style={{ color: 'rgba(244,242,236,.88)' }}>
              <span style={{ color: '#FB7185' }}>!</span><span className="line-clamp-2">{p}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === 'spotlight') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-28 h-28 rounded-full flex items-center justify-center mb-4" style={{ background: `radial-gradient(circle at 32% 28%,${theme.accent},transparent 52%),linear-gradient(145deg,#3d3d38,#1c1c19)`, boxShadow: '0 20px 48px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.12)' }}>
          <span className="text-4xl font-black" style={{ color: ink }}>!</span>
        </div>
        <div className="text-[15px] font-bold mb-1.5 px-3 leading-tight" style={{ color: ink }}>{title}</div>
        <div className="text-[11px] max-w-[200px] leading-snug" style={{ color: 'rgba(244,242,236,.55)' }}>{points[0] || 'Key signal'}</div>
      </div>
    );
  }

  if (layout === 'matrix') {
    const colors = ['#10B981', '#F59E0B', '#F59E0B', '#F43F5E'];
    const labels = ['Lower', 'Watch', 'Watch', 'Higher'];
    return (
      <div className="w-full h-full grid grid-cols-2 gap-2.5 p-4">
        {colors.map((color, i) => (
          <div key={i} className="rounded-xl p-3 min-h-[78px]" style={{ border: `1px solid ${color}55`, background: 'rgba(244,242,236,.06)' }}>
            <div className="text-[9px] uppercase tracking-[.12em] font-bold mb-1.5" style={{ color }}>{labels[i]}</div>
            <div className="text-[10px] font-semibold leading-snug line-clamp-3" style={{ color: 'rgba(244,242,236,.85)' }}>{points[i] || 'Risk signal'}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-5 gap-3">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(244,242,236,.1)', border: `1px solid ${line}` }}>
        <span className="text-2xl font-black" style={{ color: ink }}>{metaphor}</span>
      </div>
      <div className="text-[12px] font-bold text-center" style={{ color: ink }}>{title}</div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
        {points.slice(0, 4).map((p, i) => (
          <div key={i} className="rounded-xl px-2.5 py-2 flex items-start gap-2" style={{ background: card, border: `1px solid ${line}` }}>
            <span className="w-5 h-5 rounded-md text-[9px] font-black flex items-center justify-center shrink-0" style={{ background: 'rgba(244,242,236,.18)', color: ink }}>{i + 1}</span>
            <span className="text-[10px] font-semibold leading-snug line-clamp-2" style={{ color: 'rgba(244,242,236,.88)' }}>{p}</span>
          </div>
        ))}
      </div>
      {points.length === 0 && <div className="text-[11px]" style={{ color: 'rgba(244,242,236,.4)' }}>Add key points to preview cards</div>}
    </div>
  );
}

function LivePptCanvas({ slide, index, total, courseTitle, onChange }) {
  const theme = courseTheme(GAMMA_THEME_ID);
  const points = Array.isArray(slide?.keyPoints) ? slide.keyPoints : [];
  const issues = visualFitIssues(slide);
  const fieldStyle = {
    background: 'transparent',
    color: theme.primary,
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    width: '100%',
    fontFamily: 'inherit'
  };

  return (
    <div className="w-full qmx-live-ppt">
      <style>{`.qmx-live-ppt input,.qmx-live-ppt textarea{background:transparent!important;color:inherit!important;border:none!important;box-shadow:none!important;border-radius:0!important;padding:0!important;min-height:0!important}.qmx-live-ppt input:focus,.qmx-live-ppt textarea:focus{outline:none!important;box-shadow:none!important}.qmx-live-ppt textarea{resize:none!important}`}</style>
      <div className="relative mx-auto rounded-[18px] overflow-hidden border" style={{ background: theme.bg, borderColor: theme.accent, maxWidth: 1000, minHeight: 540, boxShadow: '0 24px 64px rgba(40,40,36,.14)' }}>
        <div className="h-12 px-5 flex items-center gap-3 border-b" style={{ borderColor: theme.accent, background: '#F4F2EC' }}>
          <div className="w-7 h-7 rounded-md text-white text-[11px] font-black flex items-center justify-center shrink-0" style={{ background: theme.primary }}>Q</div>
          <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold truncate" style={{ color: theme.primary }}>{courseTitle}</div></div>
          <div className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: theme.body }}>Part {index + 1} of {total}</div>
          <div className="w-28 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: theme.accent }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(8, ((index + 1) / Math.max(1, total)) * 100)}%`, background: theme.primary }} />
          </div>
        </div>

        <div className="grid md:grid-cols-[1.12fr_.88fr] gap-0 min-h-[460px]">
          <div className="p-7 md:p-9 flex flex-col justify-center" style={{ background: theme.bg }}>
            <div className="text-[10px] font-black uppercase tracking-[.14em] mb-3" style={{ color: theme.muted || theme.body }}>Section {index + 1} · {(slide.layout || 'concept').toUpperCase()}</div>
            <textarea value={slide.title || ''} onChange={(e) => onChange({ title: e.target.value, visualTitle: e.target.value })} rows={2} className="w-full font-black tracking-tight mb-4" style={{ ...fieldStyle, color: theme.primary, fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.08, fontWeight: 800 }} placeholder="Slide title — click to edit" />
            <textarea value={slide.introText || slide.content || ''} onChange={(e) => onChange({ introText: e.target.value, content: e.target.value })} rows={4} className="w-full leading-relaxed mb-5" style={{ ...fieldStyle, color: theme.body, fontSize: 15, lineHeight: 1.55 }} placeholder="Learner-facing explanation — edit directly on the slide" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {points.map((point, i) => (
                <div key={i} className="rounded-xl px-3.5 py-3" style={{ background: '#F4F2EC', border: `1px solid ${theme.accent}`, boxShadow: '0 1px 0 rgba(40,40,36,.04)' }}>
                  <div className="text-[9px] font-black uppercase tracking-wider mb-1.5" style={{ color: theme.muted || theme.body }}>{String(i + 1).padStart(2, '0')}</div>
                  <input value={point} onChange={(e) => { const next = [...points]; next[i] = e.target.value; onChange({ keyPoints: next }); }} className="w-full text-[13px] font-semibold" style={{ ...fieldStyle, color: theme.primary }} placeholder={`Point ${i + 1}`} />
                </div>
              ))}
              {points.length < 6 && (
                <button type="button" onClick={() => onChange({ keyPoints: [...points, ''] })} className="rounded-xl px-3.5 py-3 border border-dashed text-[12px] font-semibold text-left" style={{ borderColor: theme.accent, color: theme.body, background: 'rgba(244,242,236,.5)' }}>+ Add point</button>
              )}
            </div>
            {issues.length > 0 && <div className="mt-4 text-[11px] leading-relaxed" style={{ color: '#8B4C3E' }}>{issues[0]}</div>}
          </div>

          <div className="relative min-h-[280px] md:min-h-full flex flex-col" style={{ background: 'radial-gradient(circle at 72% 18%,rgba(203,197,184,.22),transparent 42%),linear-gradient(160deg,#2c2c28,#1a1a18)' }}>
            <div className="flex-1 relative min-h-[240px]"><LiveVisualPreview slide={slide} theme={theme} /></div>
            <div className="px-4 pb-2">
              <input value={slide.visualTitle || ''} onChange={(e) => onChange({ visualTitle: e.target.value })} className="w-full text-center text-[12px] font-bold" style={{ ...fieldStyle, color: '#F4F2EC' }} placeholder="Visual title" />
            </div>
            <div className="px-4 pb-4 flex gap-2 justify-center flex-wrap">
              <select value={slide.layout || 'cards'} onChange={(e) => onChange({ layout: e.target.value })} className="text-[10px] rounded-lg px-2.5 py-1.5 font-semibold" style={{ background: 'rgba(244,242,236,.12)', color: '#F4F2EC', border: '1px solid rgba(244,242,236,.22)' }}>
                {COURSE_LAYOUTS.map(([id, label]) => <option key={id} value={id} style={{ color: '#111', background: '#fff' }}>{label}</option>)}
              </select>
              <select value={slide.visualMetaphor || 'shield'} onChange={(e) => onChange({ visualMetaphor: e.target.value })} className="text-[10px] rounded-lg px-2.5 py-1.5 font-semibold" style={{ background: 'rgba(244,242,236,.12)', color: '#F4F2EC', border: '1px solid rgba(244,242,236,.22)' }}>
                {METAPHORS.map(([id, label]) => <option key={id} value={id} style={{ color: '#111', background: '#fff' }}>{label}</option>)}
              </select>
              <select value={slide.screenType || 'concept'} onChange={(e) => onChange({ screenType: e.target.value })} className="text-[10px] rounded-lg px-2.5 py-1.5 font-semibold" style={{ background: 'rgba(244,242,236,.12)', color: '#F4F2EC', border: '1px solid rgba(244,242,236,.22)' }}>
                {SCREEN_TYPES.map(([id, label]) => <option key={id} value={id} style={{ color: '#111', background: '#fff' }}>{label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="h-12 px-5 flex items-center justify-between border-t" style={{ borderColor: theme.accent, background: '#F4F2EC' }}>
          <span className="text-[11px] font-semibold" style={{ color: theme.body }}>Previous</span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.body }}>Gamma Editorial</span>
          <span className="text-[11px] font-semibold px-3 py-1 rounded-md text-white" style={{ background: theme.primary }}>Next</span>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-500 mt-3">Edit title, body and points on the paper slide — same look learners see. Vector layout controls sit on the art panel.</p>
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
      .then((res) => { setAnalysis(normalizeAnalysis(res.data.analysis || {})); setSelected(0); })
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
        topic: topic.trim(), description: description.trim(), fileBase64, mimeType: file?.type || '', detailLevel, templateId: GAMMA_THEME_ID
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
    if (quizError) { setError(quizError); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/author/generate'), {
        analysis: cleanForGenerate(analysis), templateId: GAMMA_THEME_ID, ...(editId ? { replacePackageId: editId } : {})
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
                <button key={i} type="button" onClick={() => setSelected(i)} className={`w-full text-left rounded-xl px-3 py-2.5 mb-1 border ${selected === i ? 'bg-[#122541] border-[#315a8b]' : 'border-transparent hover:bg-[#0d1928]'}`}>
                  <div className="text-[9px] uppercase tracking-[.1em] text-slate-500">{String(i + 1).padStart(2, '0')} · {item.layout}</div>
                  <div className="text-xs font-semibold truncate mt-0.5">{item.title}</div>
                </button>
              ))}
            </aside>

            <div className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <input value={analysis.title || ''} onChange={(e) => setAnalysis((prev) => prev ? { ...prev, title: e.target.value } : prev)} className="flex-1 bg-transparent border-0 outline-none text-lg font-semibold text-white" placeholder="Course title" />
                <div className="flex gap-2">
                  <button type="button" disabled={selected === 0} onClick={() => setSelected((v) => Math.max(0, v - 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <button type="button" disabled={selected >= analysis.slides.length - 1} onClick={() => setSelected((v) => Math.min(analysis.slides.length - 1, v + 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
              </div>

              <LivePptCanvas slide={slide} index={selected} total={analysis.slides.length} courseTitle={analysis.title} onChange={updateSlide} />

              <div className="scorm-panel rounded-2xl border p-4">
                <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold mb-2">Reveal text (after interaction)</div>
                <textarea rows={2} value={slide.revealText || ''} onChange={(e) => updateSlide({ revealText: e.target.value })} className="w-full p-2.5 text-sm rounded-xl" placeholder="Optional detail shown after the learner explores the slide" />
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
