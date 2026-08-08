import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';

const DETAILS = [
  ['detailed', 'Detailed', '8–12 screens'],
  ['condensed', 'Condensed', '5–7 screens'],
  ['summary', 'Summary', '3–4 screens']
];
const THEMES = [[1, 'Orange Corporate'], [4, 'Green Growth'], [5, 'Pink Modern'], [3, 'Amber Classic']];
const LAYOUTS = ['cards', 'process', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle'];
const DRAFT_KEY = 'quizmoto_scorm_visual_author_v2';

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

function normalizeSlide(s = {}, index = 0) {
  return {
    ...s,
    title: String(s.title || `Section ${index + 1}`),
    content: String(s.content || ''),
    keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.map(String) : [],
    layout: LAYOUTS.includes(String(s.layout || s.slideType || '').toLowerCase())
      ? String(s.layout || s.slideType).toLowerCase()
      : 'cards',
    visualTitle: String(s.visualTitle || s.title || `Section ${index + 1}`),
    interaction: s.interaction && typeof s.interaction === 'object'
      ? { ...s.interaction }
      : { type: 'hotspot_explore', prompt: 'Explore the learning points before continuing.' },
    imageQuery: String(s.imageQuery || '')
  };
}

function normalizeQuiz(q = {}) {
  const options = Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 6).map(String) : ['', '', '', ''];
  let correct = Number(q.correctAnswer) || 0;
  if (correct < 0 || correct >= options.length) correct = 0;
  return {
    ...q,
    question: String(q.question || 'Question'),
    options,
    correctAnswer: correct,
    explanation: String(q.explanation || '')
  };
}

function normalizeAnalysis(a = {}) {
  return {
    ...a,
    title: String(a.title || 'Untitled course'),
    summary: String(a.summary || ''),
    slides: (Array.isArray(a.slides) ? a.slides : []).map(normalizeSlide),
    quiz: (Array.isArray(a.quiz) ? a.quiz : []).map(normalizeQuiz)
  };
}

function cleanForGenerate(a) {
  return {
    ...a,
    title: String(a.title || '').trim() || 'Untitled course',
    summary: String(a.summary || '').trim(),
    slides: (a.slides || []).map((s, index) => ({
      ...s,
      title: String(s.title || '').trim() || `Section ${index + 1}`,
      content: String(s.content || '').trim(),
      keyPoints: (s.keyPoints || []).map((x) => String(x || '').trim()).filter(Boolean),
      layout: LAYOUTS.includes(s.layout) ? s.layout : 'cards',
      visualTitle: String(s.visualTitle || s.title || '').trim(),
      interaction: {
        type: String(s.interaction?.type || 'hotspot_explore'),
        prompt: String(s.interaction?.prompt || '').trim()
      },
      imageQuery: String(s.imageQuery || '').trim()
    })),
    quiz: (a.quiz || []).map(normalizeQuiz)
  };
}

export default function ScormAuthorVisual() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit') || '';
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [file, setFile] = useState(null);
  const [detail, setDetail] = useState('detailed');
  const [theme, setTheme] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [step, setStep] = useState('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(0);
  const [quizOpen, setQuizOpen] = useState(-1);
  const [result, setResult] = useState(null);
  const [replaceId, setReplaceId] = useState(editId || null);

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  useEffect(() => {
    if (!editId || !token) return;
    setBusy(true);
    axios.get(apiUrl(`/api/scorm/packages/${editId}/analysis`), { headers })
      .then((res) => {
        setAnalysis(normalizeAnalysis(res.data.analysis || {}));
        setTheme(res.data.templateId || 1);
        setReplaceId(res.data.packageId || editId);
        setStep('preview');
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setBusy(false));
  }, [editId, token, headers]);

  useEffect(() => {
    if (editId || analysis) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.analysis) {
        setAnalysis(normalizeAnalysis(draft.analysis));
        setTheme(draft.theme || 1);
        setDetail(draft.detail || 'detailed');
        setStep('preview');
      }
    } catch (_) {}
  }, [editId, analysis]);

  useEffect(() => {
    if (step !== 'preview' || !analysis) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ analysis, theme, detail, savedAt: Date.now() })); } catch (_) {}
  }, [analysis, theme, detail, step]);

  const analyze = async () => {
    if (!file) { setError('Choose a PDF or PowerPoint first.'); return; }
    setBusy(true); setError('');
    try {
      const fileBase64 = await toBase64(file);
      const res = await axios.post(apiUrl('/api/scorm/author/analyze'), {
        fileBase64,
        mimeType: file.type || 'application/pdf',
        detailLevel: detail
      }, { headers, timeout: 180000 });
      setAnalysis(normalizeAnalysis(res.data.analysis || {}));
      setExpanded(0); setQuizOpen(-1); setStep('preview');
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };

  const updateSlide = (index, patch) => setAnalysis((prev) => {
    const slides = [...prev.slides]; slides[index] = { ...slides[index], ...patch }; return { ...prev, slides };
  });
  const updatePoint = (si, pi, value) => setAnalysis((prev) => {
    const slides = [...prev.slides]; const keyPoints = [...slides[si].keyPoints]; keyPoints[pi] = value; slides[si] = { ...slides[si], keyPoints }; return { ...prev, slides };
  });
  const addPoint = (si) => updateSlide(si, { keyPoints: [...analysis.slides[si].keyPoints, ''] });
  const removePoint = (si, pi) => updateSlide(si, { keyPoints: analysis.slides[si].keyPoints.filter((_, i) => i !== pi) });
  const updateQuiz = (qi, patch) => setAnalysis((prev) => {
    const quiz = [...prev.quiz]; quiz[qi] = { ...quiz[qi], ...patch }; return { ...prev, quiz };
  });

  const generate = async () => {
    if (!analysis?.slides?.length) { setError('Add at least one learning screen.'); return; }
    setBusy(true); setError('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/author/generate'), {
        analysis: cleanForGenerate(analysis),
        templateId: theme,
        ...(replaceId ? { replacePackageId: replaceId } : {})
      }, { headers, timeout: 180000 });
      setResult(res.data); setReplaceId(res.data.packageId || replaceId); setStep('done');
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };

  const createCourse = async (publish) => {
    if (!result?.packageId) return;
    setBusy(true); setError('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/courses'), { packageId: result.packageId, title: result.title || analysis.title }, { headers });
      if (publish) await axios.patch(apiUrl(`/api/scorm/courses/${res.data.id}`), { status: 'published' }, { headers });
      navigate(`/scorm/courses/${res.data.id}`);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto relative z-10 pb-24">
    <div className="flex flex-wrap justify-between gap-4 items-start mb-7"><div><Link to="/scorm" className="text-white/50 hover:text-white text-sm font-bold">← SCORM World</Link><h1 className="text-3xl md:text-4xl font-black italic tracking-tighter mt-2">{editId ? 'Edit Visual Course' : 'AI Visual Author'}</h1><p className="text-white/45 text-sm mt-1">PDF/PPT → visual learning blueprint → animated SVG course → SCORM 1.2.</p></div>{analysis && step === 'preview' && <Link to={replaceId ? `/scorm/visual-studio?edit=${replaceId}` : '/scorm/visual-studio'} className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm font-black">Visual Studio</Link>}</div>
    {error && <div className="mb-5 rounded-xl bg-red-500/15 border border-red-400/30 p-3 text-sm text-red-100">{error}</div>}

    {step === 'upload' && <div className="rounded-3xl bg-white/5 border border-white/10 p-6 space-y-6 max-w-3xl">
      <div><label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Source document</label><input type="file" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-quizmoto-blue file:text-white file:font-bold" />{file && <div className="text-xs text-white/40 mt-2">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}</div>
      <div><label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Detail level</label><div className="flex flex-wrap gap-2">{DETAILS.map(([id, label, hint]) => <button key={id} type="button" onClick={() => setDetail(id)} className={`px-4 py-3 rounded-xl border text-xs font-black ${detail === id ? 'bg-quizmoto-yellow text-black border-quizmoto-yellow' : 'bg-white/5 border-white/10 text-white/70'}`}>{label}<span className="block text-[10px] opacity-60 font-medium mt-1">{hint}</span></button>)}</div></div>
      <button type="button" disabled={busy || !file} onClick={analyze} className="w-full py-3.5 rounded-xl bg-quizmoto-green font-black disabled:opacity-40">{busy ? 'Designing visual course…' : 'Analyze & design course'}</button>
    </div>}

    {step === 'preview' && analysis && <div className="space-y-5">
      <div className="grid lg:grid-cols-[1fr_250px] gap-4"><div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3"><input value={analysis.title} onChange={(e) => setAnalysis({ ...analysis, title: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 font-black" /><textarea value={analysis.summary} onChange={(e) => setAnalysis({ ...analysis, summary: e.target.value })} rows={3} className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm" /></div><div className="rounded-3xl bg-white/5 border border-white/10 p-5"><label className="text-[10px] font-black uppercase tracking-widest text-white/40">Theme</label><select value={theme} onChange={(e) => setTheme(Number(e.target.value))} className="w-full mt-2 bg-white/10 border border-white/10 rounded-xl p-2.5 text-sm">{THEMES.map(([id, label]) => <option className="text-black" value={id} key={id}>{label}</option>)}</select><div className="text-[10px] text-white/35 mt-3">Layouts and vectors can be refined further in Visual Studio after generation.</div></div></div>

      <div className="rounded-3xl bg-white/5 border border-white/10 p-5"><div className="flex justify-between items-center mb-3"><div className="text-[10px] font-black uppercase tracking-widest text-white/40">Learning screens · {analysis.slides.length}</div><button type="button" onClick={() => { const slides = [...analysis.slides, normalizeSlide({ title: 'New section', keyPoints: ['', '', ''] }, analysis.slides.length)]; setAnalysis({ ...analysis, slides }); setExpanded(slides.length - 1); }} className="text-xs font-black bg-white/10 rounded-lg px-3 py-2">+ Screen</button></div>
        <div className="space-y-2">{analysis.slides.map((s, i) => <div key={i} className="rounded-2xl border border-white/10 overflow-hidden"><button type="button" onClick={() => setExpanded(expanded === i ? -1 : i)} className="w-full px-4 py-3 bg-white/5 flex items-center justify-between text-left"><div className="min-w-0"><span className="text-[9px] uppercase tracking-widest text-quizmoto-yellow font-black mr-2">{s.layout}</span><span className="font-black text-sm">{i + 1}. {s.title}</span></div><span className="text-white/40">{expanded === i ? '▼' : '▶'}</span></button>{expanded === i && <div className="p-4 border-t border-white/10 grid lg:grid-cols-[1fr_210px] gap-4"><div className="space-y-2"><input value={s.title} onChange={(e) => updateSlide(i, { title: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-xl p-2.5 font-bold"/><textarea rows={4} value={s.content} onChange={(e) => updateSlide(i, { content: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-xl p-2.5 text-sm"/>{s.keyPoints.map((p, pi) => <div key={pi} className="flex gap-2"><input value={p} onChange={(e) => updatePoint(i, pi, e.target.value)} className="flex-1 bg-white/10 border border-white/10 rounded-lg px-2.5 py-2 text-sm"/><button type="button" onClick={() => removePoint(i, pi)} className="px-2 text-red-300">×</button></div>)}<button type="button" onClick={() => addPoint(i)} className="text-xs font-black text-quizmoto-yellow">+ learning point</button></div><div className="space-y-3"><div><label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Layout</label><select value={s.layout} onChange={(e) => updateSlide(i, { layout: e.target.value })} className="w-full mt-1 bg-white/10 border border-white/10 rounded-lg p-2 text-xs">{LAYOUTS.map((l) => <option className="text-black" key={l}>{l}</option>)}</select></div><div><label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Visual title</label><input value={s.visualTitle} onChange={(e) => updateSlide(i, { visualTitle: e.target.value })} className="w-full mt-1 bg-white/10 border border-white/10 rounded-lg p-2 text-xs"/></div><div><label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Interaction prompt</label><textarea rows={3} value={s.interaction?.prompt || ''} onChange={(e) => updateSlide(i, { interaction: { ...(s.interaction || {}), prompt: e.target.value } })} className="w-full mt-1 bg-white/10 border border-white/10 rounded-lg p-2 text-xs"/></div><button type="button" onClick={() => setAnalysis({ ...analysis, slides: analysis.slides.filter((_, x) => x !== i) })} className="text-xs text-red-300 font-bold">Remove screen</button></div></div>}</div>)}</div>
      </div>

      <div className="rounded-3xl bg-white/5 border border-white/10 p-5"><div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Knowledge checks · {analysis.quiz.length}</div><div className="space-y-2">{analysis.quiz.map((q, qi) => <div key={qi} className="rounded-2xl border border-white/10 overflow-hidden"><button type="button" className="w-full px-4 py-3 bg-white/5 text-left font-bold text-sm" onClick={() => setQuizOpen(quizOpen === qi ? -1 : qi)}>Q{qi + 1}. {q.question}</button>{quizOpen === qi && <div className="p-4 space-y-2 border-t border-white/10"><textarea rows={2} value={q.question} onChange={(e) => updateQuiz(qi, { question: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-xl p-2.5 font-bold"/>{q.options.map((opt, oi) => <div key={oi} className="flex items-center gap-2"><input type="radio" name={`q-${qi}`} checked={q.correctAnswer === oi} onChange={() => updateQuiz(qi, { correctAnswer: oi })}/><input value={opt} onChange={(e) => { const options = [...q.options]; options[oi] = e.target.value; updateQuiz(qi, { options }); }} className="flex-1 bg-white/10 border border-white/10 rounded-lg p-2 text-sm"/></div>)}<textarea rows={2} value={q.explanation || ''} onChange={(e) => updateQuiz(qi, { explanation: e.target.value })} placeholder="Answer explanation" className="w-full bg-white/10 border border-white/10 rounded-xl p-2.5 text-sm"/></div>}</div>)}</div></div>
      <div className="sticky bottom-2 flex gap-3"><button type="button" onClick={() => setStep('upload')} className="px-4 py-3 rounded-xl bg-white/10 font-bold">Back</button><button type="button" disabled={busy} onClick={generate} className="flex-1 py-3 rounded-xl bg-quizmoto-blue font-black disabled:opacity-40">{busy ? 'Generating vectors & package…' : replaceId ? 'Save & rebuild visual package' : 'Generate visual SCORM package'}</button></div>
    </div>}

    {step === 'done' && result && <div className="rounded-3xl bg-white/5 border border-white/10 p-8 max-w-3xl text-center mx-auto"><div className="text-5xl mb-3">✓</div><h2 className="text-2xl font-black">Visual package ready</h2><p className="text-sm text-white/50 mt-2">{result.title} · {result.status}</p><div className="grid sm:grid-cols-2 gap-3 mt-6"><Link to={`/scorm/visual-studio?edit=${result.packageId}`} className="py-3 rounded-xl bg-quizmoto-yellow text-black font-black">Open Visual Studio</Link><button disabled={busy} onClick={() => createCourse(false)} className="py-3 rounded-xl bg-quizmoto-green font-black disabled:opacity-40">Create course</button><button disabled={busy} onClick={() => createCourse(true)} className="py-3 rounded-xl bg-quizmoto-blue font-black disabled:opacity-40">Create & publish</button><Link to="/scorm/library" className="py-3 rounded-xl bg-white/10 font-bold">Package library</Link></div></div>}
  </div>;
}
