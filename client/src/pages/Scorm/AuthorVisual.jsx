import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Check, ChevronLeft, ChevronRight, FileText, Palette, Sparkles, UploadCloud } from 'lucide-react';
import { apiUrl } from '../../config';
import {
  BACKGROUND_STYLES,
  COURSE_LAYOUTS,
  COURSE_THEMES,
  METAPHORS,
  SCREEN_TYPES,
  courseTheme,
  normalizeCourseSlide,
  wordCount
} from './courseExperienceV5';

const DETAILS = [
  ['detailed', 'Detailed', '8–12 experiences'],
  ['condensed', 'Condensed', '5–7 experiences'],
  ['summary', 'Summary', '3–4 experiences']
];

const DRAFT_KEY = 'quizmoto_scorm_course_experience_v5';

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

function normalizeAnalysis(value) {
  const analysis = value && typeof value === 'object' ? value : {};
  return {
    ...analysis,
    title: analysis.title || 'Learning experience',
    summary: analysis.summary || '',
    slides: (analysis.slides || []).map(normalizeCourseSlide),
    quiz: Array.isArray(analysis.quiz) ? analysis.quiz : []
  };
}

function cleanForGenerate(analysis) {
  if (!analysis) return null;
  return {
    ...analysis,
    slides: (analysis.slides || []).map(({ visualAsset, mobileVisualAsset, ...slide }) => slide)
  };
}

function ThemeCard({ theme, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border p-3 text-left transition-all ${selected ? 'border-white/50 ring-2 ring-white/15 translate-y-[-1px]' : 'border-white/10 hover:border-white/25'}`}
      style={{ background: `linear-gradient(145deg,${theme.bg},${theme.bg2})` }}
    >
      {selected && <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: theme.primary }}><Check size={13} /></div>}
      <div className="h-16 rounded-xl border border-white/10 relative overflow-hidden mb-3" style={{ background: `radial-gradient(circle at 72% 20%,${theme.accent}38,transparent 50%),linear-gradient(135deg,${theme.surface},${theme.visual})` }}>
        <div className="absolute left-3 bottom-3 flex gap-1.5"><span className="w-5 h-5 rounded-md" style={{ background: theme.primary }} /><span className="w-5 h-5 rounded-md" style={{ background: theme.accent }} /><span className="w-5 h-5 rounded-md border border-white/20" style={{ background: theme.visual }} /></div>
      </div>
      <div className="text-[12px] font-semibold text-white">{theme.name}</div>
      <div className="text-[10px] text-white/50 mt-1">{theme.description}</div>
    </button>
  );
}

function MiniExperiencePreview({ analysis, themeId, selected }) {
  const theme = courseTheme(themeId);
  const slide = analysis?.slides?.[selected];
  if (!slide) return null;
  return (
    <div className="rounded-[24px] border border-white/10 overflow-hidden shadow-2xl" style={{ background: `linear-gradient(160deg,${theme.bg2},${theme.bg})` }}>
      <div className="h-12 px-4 flex items-center gap-3 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl text-white text-xs font-bold flex items-center justify-center" style={{ background: `linear-gradient(145deg,${theme.primary},${theme.dark})` }}>Q</div>
        <div className="min-w-0"><div className="text-xs font-semibold text-white truncate">{analysis.title}</div><div className="text-[9px] text-white/40">Course Experience V5 · {theme.name}</div></div>
        <div className="ml-auto w-24 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(8, ((selected + 1) / Math.max(1, analysis.slides.length)) * 100)}%`, background: `linear-gradient(90deg,${theme.primary},${theme.accent})` }} /></div>
      </div>
      <div className="p-4 md:p-5 grid lg:grid-cols-[.74fr_1.26fr] gap-4 min-h-[360px]">
        <div className="rounded-2xl border border-white/10 p-5 flex flex-col justify-center" style={{ background: theme.surface }}>
          <div className="text-[9px] uppercase tracking-[.14em] font-bold mb-2" style={{ color: theme.accent }}>{slide.screenType} · {slide.layout}</div>
          <h3 className="text-[25px] leading-[1.03] tracking-[-.04em] text-white font-semibold">{slide.title}</h3>
          <p className="text-[13px] leading-relaxed text-white/65 mt-3">{slide.introText || slide.content}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{(slide.keyPoints || []).slice(0, 4).map((_, i) => <span key={i} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] text-white/60" style={{ background: `${theme.primary}18` }}>Explore {i + 1}</span>)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 relative overflow-hidden min-h-[300px] flex items-center justify-center" style={{ background: `radial-gradient(circle at 70% 20%,${theme.accent}24,transparent 42%),linear-gradient(145deg,${theme.visual},${theme.bg2})` }}>
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(${theme.accent}22 1px,transparent 1px),linear-gradient(90deg,${theme.accent}22 1px,transparent 1px)`, backgroundSize: '28px 28px' }} />
          <div className="relative w-44 h-44 rounded-full flex items-center justify-center text-center p-6 text-white font-semibold shadow-2xl" style={{ background: `radial-gradient(circle at 30% 20%,${theme.accent},transparent 46%),linear-gradient(145deg,${theme.primary},${theme.dark})` }}>
            <div><div className="text-[10px] uppercase tracking-[.12em] opacity-65 mb-2">{slide.visualMetaphor}</div><div className="text-lg leading-tight">{slide.visualTitle}</div></div>
          </div>
        </div>
      </div>
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
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [themeId, setThemeId] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    if (editId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (stored?.analysis) {
        setAnalysis(normalizeAnalysis(stored.analysis));
        setThemeId(Number(stored.themeId) || 1);
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
        setThemeId(Number(res.data.templateId) || Number(res.data.analysis?.themeId) || 1);
        setSelected(0);
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setBusy(false));
  }, [editId, token, headers]);

  useEffect(() => {
    if (!analysis || editId) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ analysis, themeId, detailLevel })); } catch (_) {}
  }, [analysis, themeId, detailLevel, editId]);

  const analyze = async () => {
    if (!file) { setError('Choose a PDF or PowerPoint file first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const fileBase64 = await toBase64(file);
      const res = await axios.post(apiUrl('/api/scorm/author/analyze'), {
        fileBase64,
        mimeType: file.type || 'application/pdf',
        detailLevel,
        templateId: themeId
      }, { headers, timeout: 180000 });
      setAnalysis(normalizeAnalysis(res.data.analysis));
      setSelected(0);
      setNotice('Learning blueprint created. Review the experience before generating the package.');
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

  const generate = async () => {
    if (!analysis) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/author/generate'), {
        analysis: cleanForGenerate({ ...analysis, themeId, themeName: courseTheme(themeId).name }),
        templateId: themeId,
        ...(editId ? { replacePackageId: editId } : {})
      }, { headers, timeout: 180000 });
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      setNotice(editId ? 'Course rebuilt successfully.' : 'Course generated successfully.');
      const id = res.data?.packageId || editId;
      if (id) navigate(`/scorm/courses/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };

  const slide = analysis?.slides?.[selected];
  const theme = courseTheme(themeId);

  return (
    <div className="min-h-screen max-w-[1500px] mx-auto p-4 md:p-7 pb-24 relative z-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">SCORM World · Course Experience V5</div>
          <h1 className="text-3xl md:text-[38px] font-semibold tracking-[-.05em] mt-1">AI Course Author</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">Turn source material into a responsive, illustrated and interactive SCORM course. Choose the colour experience before generation, then refine each learning screen.</p>
        </div>
        <div className="flex gap-2"><Link to="/scorm/visual-studio" className="scorm-button-secondary px-4 py-2.5 text-xs font-semibold">Visual Studio</Link>{analysis && <button type="button" onClick={generate} disabled={busy} className="scorm-button-primary px-5 py-2.5 text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Sparkles size={15} />{busy ? 'Building…' : editId ? 'Rebuild course' : 'Generate SCORM'}</button>}</div>
      </div>

      {error && <div className="scorm-alert-danger rounded-xl border p-3 text-sm mb-5">{error}</div>}
      {notice && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-sm text-emerald-100 mb-5 inline-flex items-center gap-2"><Check size={15} />{notice}</div>}

      {!analysis && !editId && (
        <div className="grid xl:grid-cols-[.85fr_1.15fr] gap-5 items-start">
          <section className="scorm-panel rounded-3xl border p-5 md:p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold"><UploadCloud size={18} />Source document</div>
              <label className="mt-3 rounded-2xl border border-dashed border-[#36516f] bg-[#08111c] min-h-[150px] flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#4b6f96] transition-colors px-5">
                <FileText size={25} className="text-slate-500" />
                <div className="text-sm font-semibold mt-3">{file ? file.name : 'Choose PDF or PowerPoint'}</div>
                <div className="text-[11px] text-slate-500 mt-1">The source stays in the authoring flow and is transformed server-side.</div>
                <input type="file" className="hidden" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold mb-2">Course depth</div>
              <div className="grid grid-cols-3 gap-2">{DETAILS.map(([id, label, hint]) => <button key={id} type="button" onClick={() => setDetailLevel(id)} className={`rounded-xl border px-3 py-3 text-left ${detailLevel === id ? 'border-[#477bc4] bg-[#102747]' : 'border-[#26374d] bg-[#0a131f]'}`}><div className="text-xs font-semibold">{label}</div><div className="text-[9px] text-slate-500 mt-1">{hint}</div></button>)}</div>
            </div>

            <button type="button" onClick={analyze} disabled={!file || busy} className="scorm-button-primary w-full py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"><Sparkles size={17} />{busy ? 'Designing learning experience…' : 'Analyse & design course'}</button>
          </section>

          <section className="scorm-panel rounded-3xl border p-5 md:p-6">
            <div className="flex items-center gap-2"><Palette size={18} /><div><div className="text-sm font-semibold">Choose course colour theme</div><div className="text-[11px] text-slate-500 mt-0.5">This controls the learner shell, backgrounds, illustrations, controls and vector artwork.</div></div></div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-3 mt-4">{COURSE_THEMES.map((item) => <ThemeCard key={item.id} theme={item} selected={themeId === item.id} onClick={() => setThemeId(item.id)} />)}</div>
          </section>
        </div>
      )}

      {editId && busy && !analysis && <div className="scorm-panel rounded-3xl border p-10 text-center text-slate-400">Loading editable course blueprint…</div>}

      {analysis && slide && (
        <div className="space-y-5">
          <section className="scorm-panel rounded-3xl border p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div><div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold">Course theme</div><div className="text-sm font-semibold mt-1">{theme.name}</div></div>
              <div className="flex flex-wrap gap-2">{COURSE_THEMES.map((item) => <button key={item.id} type="button" title={item.name} onClick={() => setThemeId(item.id)} className={`w-9 h-9 rounded-xl border-2 transition-transform ${themeId === item.id ? 'border-white scale-110' : 'border-white/10'}`} style={{ background: `linear-gradient(145deg,${item.primary},${item.accent})` }} />)}</div>
            </div>
            <MiniExperiencePreview analysis={analysis} themeId={themeId} selected={selected} />
          </section>

          <div className="grid xl:grid-cols-[230px_minmax(0,1fr)_360px] gap-4 items-start">
            <aside className="scorm-panel rounded-3xl border p-3 xl:sticky xl:top-24 max-h-[74vh] overflow-auto">
              <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold px-2 py-2">Learning experiences</div>
              {analysis.slides.map((item, i) => <button key={i} type="button" onClick={() => setSelected(i)} className={`w-full text-left rounded-xl px-3 py-3 mb-1 border ${selected === i ? 'bg-[#122541] border-[#315a8b]' : 'border-transparent hover:bg-[#0d1928]'}`}><div className="text-[9px] uppercase tracking-[.1em] text-slate-500">{String(i + 1).padStart(2, '0')} · {item.screenType || item.layout}</div><div className="text-xs font-semibold truncate mt-1">{item.title}</div></button>)}
            </aside>

            <main className="scorm-panel rounded-3xl border p-5 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-4"><div><div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold">Screen {selected + 1}</div><h2 className="text-xl font-semibold mt-1">{slide.title}</h2></div><div className="flex gap-2"><button type="button" disabled={selected === 0} onClick={() => setSelected((v) => Math.max(0, v - 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30"><ChevronLeft size={16} /></button><button type="button" disabled={selected >= analysis.slides.length - 1} onClick={() => setSelected((v) => Math.min(analysis.slides.length - 1, v + 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30"><ChevronRight size={16} /></button></div></div>
              <div className="rounded-2xl border border-[#26374d] bg-[#08111c] p-4">
                <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold">Initial learner context</div><div className="text-sm text-slate-300 leading-relaxed mt-2">{slide.introText || slide.content}</div>
                {!!slide.revealText && <><div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold mt-5">Progressive reveal</div><div className="text-sm text-slate-400 leading-relaxed mt-2">{slide.revealText}</div></>}
                <div className="mt-5 grid sm:grid-cols-2 gap-2">{(slide.keyPoints || []).map((point, i) => <div key={i} className="rounded-xl border border-[#26374d] bg-[#0d1928] px-3 py-3 text-xs text-slate-300"><span className="font-bold mr-2" style={{ color: theme.accent }}>{i + 1}</span>{point}</div>)}</div>
              </div>
            </main>

            <aside className="scorm-panel rounded-3xl border p-4 space-y-4 xl:sticky xl:top-24 max-h-[74vh] overflow-auto">
              <div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Screen title</label><input value={slide.title || ''} onChange={(e) => updateSlide({ title: e.target.value })} className="w-full p-2.5 text-sm" /></div>
              <div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Screen type</label><select value={slide.screenType || 'concept'} onChange={(e) => updateSlide({ screenType: e.target.value })} className="w-full p-2.5 text-sm">{SCREEN_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
              <div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Initial context</label><textarea rows={4} value={slide.introText || ''} onChange={(e) => updateSlide({ introText: e.target.value })} className="w-full p-2.5 text-sm leading-relaxed" /><div className="text-[10px] text-slate-500 mt-1">{wordCount(slide.introText)} words · keep this concise</div></div>
              <div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Progressive reveal</label><textarea rows={5} value={slide.revealText || ''} onChange={(e) => updateSlide({ revealText: e.target.value })} className="w-full p-2.5 text-sm leading-relaxed" placeholder="Detail revealed after learner interaction" /></div>
              <div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Visual labels</label><textarea rows={5} value={(slide.keyPoints || []).join('\n')} onChange={(e) => updateSlide({ keyPoints: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} className="w-full p-2.5 text-sm" placeholder="One short label per line" /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Layout</label><select value={slide.layout} onChange={(e) => updateSlide({ layout: e.target.value })} className="w-full p-2.5 text-xs">{COURSE_LAYOUTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Background</label><select value={slide.backgroundStyle || 'mesh'} onChange={(e) => updateSlide({ backgroundStyle: e.target.value })} className="w-full p-2.5 text-xs">{BACKGROUND_STYLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Visual metaphor</label><select value={slide.visualMetaphor || 'shield'} onChange={(e) => updateSlide({ visualMetaphor: e.target.value })} className="w-full p-2.5 text-xs">{METAPHORS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Visual title</label><input value={slide.visualTitle || ''} onChange={(e) => updateSlide({ visualTitle: e.target.value })} className="w-full p-2.5 text-xs" /></div></div>
              <div><label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Interaction prompt</label><textarea rows={3} value={slide.interaction?.prompt || ''} onChange={(e) => updateSlide({ interaction: { ...(slide.interaction || {}), prompt: e.target.value } })} className="w-full p-2.5 text-sm" /></div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
