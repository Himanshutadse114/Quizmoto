import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';

const LAYOUTS = [
  ['cards', 'Cards'],
  ['process', 'Process'],
  ['timeline', 'Timeline'],
  ['comparison', 'Comparison'],
  ['hub', 'Hub diagram'],
  ['spotlight', 'Spotlight'],
  ['matrix', 'Risk matrix'],
  ['cycle', 'Cycle']
];

const THEMES = [
  [1, 'Orange Corporate'],
  [4, 'Green Growth'],
  [5, 'Pink Modern'],
  [3, 'Amber Classic']
];

const THEME_COLORS = {
  1: { primary: '#f97316', soft: '#fff1e6' },
  3: { primary: '#b45309', soft: '#fef3c7' },
  4: { primary: '#059669', soft: '#d1fae5' },
  5: { primary: '#db2777', soft: '#fce7f3' }
};

function normalizeSlide(s, index) {
  return {
    ...s,
    title: s?.title || `Section ${index + 1}`,
    content: s?.content || '',
    keyPoints: Array.isArray(s?.keyPoints) ? s.keyPoints : [],
    layout: s?.layout || 'cards',
    visualTitle: s?.visualTitle || s?.title || `Section ${index + 1}`,
    interaction: {
      type: s?.interaction?.type || 'hotspot_explore',
      prompt: s?.interaction?.prompt || 'Explore the learning points before continuing.'
    }
  };
}

function Preview({ slide, theme }) {
  const points = (slide.keyPoints || []).filter(Boolean).slice(0, 6);
  const colors = THEME_COLORS[theme] || THEME_COLORS[1];
  const common = { '--preview-primary': colors.primary, '--preview-soft': colors.soft };

  const Card = ({ p, i }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={{ borderLeft: `5px solid ${colors.primary}` }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm mb-3" style={{ background: colors.soft, color: colors.primary }}>{i + 1}</div>
      <div className="text-sm font-bold text-slate-700 leading-snug">{p}</div>
    </div>
  );

  let visual;
  if (slide.layout === 'process') {
    visual = <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{points.slice(0, 4).map((p, i) => <Card key={i} p={p} i={i} />)}</div>;
  } else if (slide.layout === 'timeline') {
    visual = <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 pt-6">{points.slice(0, 4).map((p, i) => <div key={i} className="text-center"><div className="mx-auto w-9 h-9 rounded-full border-[6px] bg-white mb-3" style={{ borderColor: colors.primary }} /><div className="rounded-xl bg-white border border-slate-200 p-3 text-xs font-bold text-slate-600">{p}</div></div>)}</div>;
  } else if (slide.layout === 'comparison') {
    const half = Math.max(1, Math.ceil(points.length / 2));
    const good = points.slice(0, half);
    const bad = points.slice(half);
    visual = <div className="grid md:grid-cols-2 gap-3"><div className="rounded-2xl border-t-4 border-green-500 bg-green-50 p-4"><div className="font-black text-green-700 text-xs uppercase tracking-widest mb-3">Recommended</div>{good.map((p, i) => <div key={i} className="text-xs font-bold text-slate-700 mb-2">✓ {p}</div>)}</div><div className="rounded-2xl border-t-4 border-red-500 bg-red-50 p-4"><div className="font-black text-red-700 text-xs uppercase tracking-widest mb-3">Watch out</div>{(bad.length ? bad : ['Verify before acting.']).map((p, i) => <div key={i} className="text-xs font-bold text-slate-700 mb-2">! {p}</div>)}</div></div>;
  } else if (slide.layout === 'hub' || slide.layout === 'cycle') {
    visual = <div className="min-h-[280px] flex items-center justify-center"><div className="relative w-[270px] h-[270px]"><div className="absolute inset-[85px] rounded-full text-white flex items-center justify-center text-center text-xs font-black p-3" style={{ background: colors.primary }}>{slide.visualTitle}</div>{points.slice(0, 6).map((p, i) => { const angle = (Math.PI * 2 * i / Math.max(1, points.length)) - Math.PI / 2; const x = 108 + Math.cos(angle) * 105; const y = 108 + Math.sin(angle) * 105; return <div key={i} title={p} className="absolute w-14 h-14 rounded-full bg-white border-4 flex items-center justify-center text-xs font-black shadow" style={{ left: x, top: y, borderColor: colors.primary, color: colors.primary }}>{i + 1}</div>; })}</div></div>;
  } else if (slide.layout === 'matrix') {
    visual = <div className="grid grid-cols-2 gap-2">{['Low', 'Medium', 'Medium', 'High'].map((label, i) => <div key={i} className={`rounded-2xl p-5 min-h-[110px] ${i === 3 ? 'bg-red-100' : i === 0 ? 'bg-green-100' : 'bg-amber-100'}`}><div className="text-[10px] font-black uppercase text-slate-500">{label}</div><div className="text-xs font-bold text-slate-700 mt-3">{points[i] || `${label} risk`}</div></div>)}</div>;
  } else if (slide.layout === 'spotlight') {
    visual = <div className="rounded-[28px] min-h-[300px] text-white flex flex-col items-center justify-center text-center p-8" style={{ background: `linear-gradient(145deg,${colors.primary},#111827)` }}><div className="w-28 h-28 rounded-full border-[14px] border-white/25 flex items-center justify-center mb-5"><div className="text-5xl font-black">!</div></div><div className="text-2xl font-black">{slide.visualTitle}</div><div className="text-sm text-white/80 mt-3 max-w-sm">{points[0]}</div></div>;
  } else {
    visual = <div className="grid md:grid-cols-2 gap-3">{points.map((p, i) => <Card key={i} p={p} i={i} />)}</div>;
  }

  return (
    <div style={common} className="rounded-[30px] bg-slate-50 border border-slate-200 overflow-hidden shadow-2xl">
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3"><div className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-black" style={{ background: colors.primary }}>Q</div><div className="text-xs font-black text-slate-500 uppercase tracking-widest">Learner preview</div></div>
      <div className="p-5 md:p-7 grid lg:grid-cols-[.65fr_1.35fr] gap-5 items-center">
        <div><div className="text-[10px] uppercase tracking-[.18em] font-black mb-2" style={{ color: colors.primary }}>{slide.layout}</div><h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{slide.title}</h2><p className="text-sm text-slate-600 mt-3 leading-relaxed">{slide.content}</p><div className="mt-4 rounded-xl px-3 py-2 text-xs font-bold" style={{ background: colors.soft, color: colors.primary }}>{slide.interaction?.prompt}</div></div>
        <div>{visual}</div>
      </div>
    </div>
  );
}

export default function VisualStudio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const packageId = searchParams.get('edit') || '';
  const [packages, setPackages] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [templateId, setTemplateId] = useState(1);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    axios.get(apiUrl('/api/scorm/packages'), { headers }).then((r) => setPackages(r.data || [])).catch(() => {});
  }, [token, headers, navigate]);

  useEffect(() => {
    if (!packageId) { setAnalysis(null); return; }
    setBusy(true); setError(null);
    axios.get(apiUrl(`/api/scorm/packages/${packageId}/analysis`), { headers })
      .then((res) => {
        const a = res.data.analysis || {};
        setAnalysis({ ...a, slides: (a.slides || []).map(normalizeSlide) });
        setTemplateId(res.data.templateId || 1);
        setSelected(0);
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setBusy(false));
  }, [packageId, headers]);

  const updateSlide = (patch) => {
    setAnalysis((prev) => {
      const slides = [...prev.slides];
      slides[selected] = { ...slides[selected], ...patch };
      return { ...prev, slides };
    });
    setSaved('Unsaved changes');
  };

  const save = async () => {
    if (!analysis || !packageId) return;
    setBusy(true); setError(null); setSaved('');
    try {
      await axios.post(apiUrl('/api/scorm/author/generate'), {
        analysis,
        templateId,
        replacePackageId: packageId
      }, { headers, timeout: 180000 });
      setSaved('Visual course rebuilt successfully');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };

  const slide = analysis?.slides?.[selected];

  return (
    <div className="min-h-screen p-4 md:p-7 max-w-[1500px] mx-auto relative z-10 pb-24">
      <div className="flex flex-wrap justify-between gap-4 items-start mb-6"><div><Link to="/scorm" className="text-white/50 text-sm font-bold hover:text-white">← SCORM World</Link><h1 className="text-3xl font-black italic tracking-tighter mt-2">Visual Studio</h1><p className="text-white/45 text-sm mt-1">Control layouts and preview the learner experience before rebuilding the package.</p></div>{analysis && <button type="button" disabled={busy} onClick={save} className="px-5 py-3 rounded-xl bg-quizmoto-green text-white font-black text-sm disabled:opacity-50">{busy ? 'Rebuilding…' : 'Save & rebuild package'}</button>}</div>
      {error && <div className="mb-5 rounded-xl bg-red-500/15 border border-red-400/30 p-3 text-sm text-red-100">{error}</div>}
      {saved && <div className="mb-5 rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white/60">{saved}</div>}

      {!packageId && <div className="rounded-3xl bg-white/5 border border-white/10 p-6"><div className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">Choose an AI-authored package</div><div className="grid md:grid-cols-2 gap-3">{packages.filter((p) => p.source === 'ai_author').map((p) => <button key={p.id} type="button" onClick={() => setSearchParams({ edit: p.id })} className="text-left rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 p-4"><div className="font-black">{p.title}</div><div className="text-xs text-white/40 mt-1">{p.standard || 'SCORM 1.2'} · {p.status}</div></button>)}</div></div>}

      {packageId && busy && !analysis && <div className="rounded-3xl bg-white/5 border border-white/10 p-10 text-center text-white/50">Loading visual blueprint…</div>}

      {analysis && slide && <div className="grid xl:grid-cols-[250px_minmax(0,1fr)_300px] gap-4 items-start">
        <aside className="rounded-3xl bg-white/5 border border-white/10 p-3 xl:sticky xl:top-4 max-h-[78vh] overflow-auto"><div className="text-[10px] font-black uppercase tracking-widest text-white/35 px-2 py-2">Screens</div>{analysis.slides.map((s, i) => <button key={i} type="button" onClick={() => setSelected(i)} className={`w-full text-left rounded-xl px-3 py-3 mb-1 border ${selected === i ? 'bg-white text-black border-white' : 'bg-white/5 text-white border-white/5 hover:bg-white/10'}`}><div className="text-[9px] uppercase tracking-widest opacity-50 font-black">{String(i + 1).padStart(2, '0')} · {s.layout}</div><div className="text-xs font-black truncate mt-1">{s.title}</div></button>)}</aside>
        <main className="min-w-0"><Preview slide={slide} theme={templateId} /></main>
        <aside className="rounded-3xl bg-white/5 border border-white/10 p-4 space-y-4 xl:sticky xl:top-4"><div><label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Layout</label><div className="grid grid-cols-2 gap-2">{LAYOUTS.map(([id, label]) => <button key={id} type="button" onClick={() => updateSlide({ layout: id })} className={`rounded-xl px-2 py-2 text-[11px] font-bold border ${slide.layout === id ? 'bg-quizmoto-yellow text-black border-quizmoto-yellow' : 'bg-white/5 text-white/70 border-white/10'}`}>{label}</button>)}</div></div>
        <div><label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Visual title</label><input value={slide.visualTitle || ''} onChange={(e) => updateSlide({ visualTitle: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-xl p-2.5 text-sm" /></div>
        <div><label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Interaction prompt</label><textarea rows={3} value={slide.interaction?.prompt || ''} onChange={(e) => updateSlide({ interaction: { ...(slide.interaction || {}), prompt: e.target.value } })} className="w-full bg-white/10 border border-white/10 rounded-xl p-2.5 text-sm" /></div>
        <div><label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Theme</label><select value={templateId} onChange={(e) => { setTemplateId(Number(e.target.value)); setSaved('Unsaved changes'); }} className="w-full bg-white/10 border border-white/10 rounded-xl p-2.5 text-sm">{THEMES.map(([id, label]) => <option className="text-black" key={id} value={id}>{label}</option>)}</select></div>
        <div className="rounded-xl bg-black/20 border border-white/10 p-3 text-[11px] text-white/45 leading-relaxed">The final package uses Python-generated SVG vectors. This preview mirrors the layout and hierarchy without requiring package generation after every edit.</div></aside>
      </div>}
    </div>
  );
}
