import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
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
  [1, 'Midnight Blue'],
  [4, 'Emerald Focus'],
  [5, 'Modern Rose'],
  [3, 'Amber Signal']
];

const THEME_COLORS = {
  1: { primary: '#2563eb', accent: '#22d3ee', soft: '#dbeafe' },
  3: { primary: '#d97706', accent: '#fbbf24', soft: '#fef3c7' },
  4: { primary: '#059669', accent: '#34d399', soft: '#d1fae5' },
  5: { primary: '#db2777', accent: '#f472b6', soft: '#fce7f3' }
};

const POINT_WORD_LIMITS = {
  process: 8,
  timeline: 8,
  cycle: 8,
  matrix: 8,
  hub: 10,
  cards: 11,
  comparison: 12,
  spotlight: 12
};

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

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

function visualFitIssues(slide) {
  const issues = [];
  const limit = POINT_WORD_LIMITS[slide.layout] || 11;
  const longPoints = (slide.keyPoints || []).filter((point) => wordCount(point) > limit).length;
  if (longPoints) issues.push(`${longPoints} visual ${longPoints === 1 ? 'point is' : 'points are'} longer than the recommended ${limit} words.`);
  if (wordCount(slide.visualTitle) > 5) issues.push('Visual title is longer than 5 words and may feel cramped in the diagram.');
  if (wordCount(slide.content) > 100) issues.push('Body copy is dense for a single learning screen. Consider tightening it below 100 words.');
  if ((slide.keyPoints || []).length > 6) issues.push('Only the first 6 visual points can be displayed in the generated vector.');
  return issues;
}

function PreviewVisual({ slide, colors }) {
  const points = (slide.keyPoints || []).filter(Boolean).slice(0, 6);

  const Card = ({ p, i }) => (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm" style={{ borderTop: `3px solid ${colors.primary}` }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm mb-3" style={{ background: colors.soft, color: colors.primary }}>{String(i + 1).padStart(2, '0')}</div>
      <div className="text-[14px] font-semibold text-slate-700 leading-[1.45]">{p}</div>
    </div>
  );

  if (slide.layout === 'process') {
    return <div className="grid grid-cols-2 gap-3">{points.slice(0, 4).map((p, i) => <Card key={i} p={p} i={i} />)}</div>;
  }

  if (slide.layout === 'timeline') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {points.slice(0, 4).map((p, i) => (
          <div key={i} className="relative rounded-[18px] border border-slate-200 bg-white p-4 pt-5 shadow-sm">
            <div className="absolute -top-3 left-4 w-7 h-7 rounded-full border-4 bg-white" style={{ borderColor: colors.primary }} />
            <div className="text-[10px] font-bold uppercase tracking-[.12em] mt-2" style={{ color: colors.primary }}>Stage {i + 1}</div>
            <div className="text-[14px] font-semibold text-slate-700 mt-2 leading-[1.45]">{p}</div>
          </div>
        ))}
      </div>
    );
  }

  if (slide.layout === 'comparison') {
    const half = Math.max(1, Math.ceil(points.length / 2));
    const good = points.slice(0, half);
    const bad = points.slice(half);
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4">
          <div className="font-bold text-emerald-700 text-[11px] uppercase tracking-[.12em] mb-3">Recommended</div>
          {good.map((p, i) => <div key={i} className="flex gap-2 text-[13px] font-semibold text-slate-700 mb-2.5"><span className="text-emerald-600">✓</span><span>{p}</span></div>)}
        </div>
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-4">
          <div className="font-bold text-rose-700 text-[11px] uppercase tracking-[.12em] mb-3">Watch out</div>
          {(bad.length ? bad : ['Verify before acting.']).map((p, i) => <div key={i} className="flex gap-2 text-[13px] font-semibold text-slate-700 mb-2.5"><span className="text-rose-600">!</span><span>{p}</span></div>)}
        </div>
      </div>
    );
  }

  if (slide.layout === 'hub' || slide.layout === 'cycle') {
    return (
      <div className="min-h-[390px] flex items-center justify-center overflow-hidden">
        <div className="relative w-[390px] h-[350px] max-w-full">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full text-white flex items-center justify-center text-center text-[15px] font-bold p-4 shadow-xl" style={{ background: `linear-gradient(145deg,${colors.primary},${colors.accent})` }}>{slide.visualTitle}</div>
          {points.slice(0, 6).map((p, i) => {
            const angle = (Math.PI * 2 * i / Math.max(1, points.length)) - Math.PI / 2;
            const x = 155 + Math.cos(angle) * 132;
            const y = 135 + Math.sin(angle) * 122;
            return (
              <div key={i} title={p} className="absolute w-[78px] min-h-[64px] rounded-2xl bg-white border flex flex-col items-center justify-center px-2 text-center shadow-md" style={{ left: x, top: y, borderColor: colors.primary }}>
                <div className="text-[10px] font-bold" style={{ color: colors.primary }}>{String(i + 1).padStart(2, '0')}</div>
                <div className="text-[10px] leading-tight text-slate-600 font-semibold line-clamp-2 mt-1">{p}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.layout === 'matrix') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {['Low', 'Medium', 'Medium', 'High'].map((label, i) => (
          <div key={i} className={`rounded-[18px] p-5 min-h-[135px] border ${i === 3 ? 'bg-rose-50 border-rose-200' : i === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{label}</div>
            <div className="text-[14px] font-semibold text-slate-700 mt-3 leading-snug">{points[i] || `${label} risk`}</div>
          </div>
        ))}
      </div>
    );
  }

  if (slide.layout === 'spotlight') {
    return (
      <div className="rounded-[24px] min-h-[390px] text-white flex flex-col items-center justify-center text-center p-8 shadow-xl" style={{ background: `radial-gradient(circle at 30% 20%,${colors.accent},transparent 28%),linear-gradient(145deg,${colors.primary},#0f172a)` }}>
        <div className="w-36 h-36 rounded-full border-[18px] border-white/20 flex items-center justify-center mb-6"><div className="text-6xl font-light">!</div></div>
        <div className="text-[26px] font-bold tracking-tight">{slide.visualTitle}</div>
        <div className="text-[14px] leading-relaxed text-white/80 mt-3 max-w-sm">{points[0]}</div>
      </div>
    );
  }

  return <div className="grid md:grid-cols-2 gap-3">{points.map((p, i) => <Card key={i} p={p} i={i} />)}</div>;
}

function Preview({ slide, theme }) {
  const points = (slide.keyPoints || []).filter(Boolean).slice(0, 6);
  const colors = THEME_COLORS[theme] || THEME_COLORS[1];

  return (
    <div className="rounded-[26px] overflow-hidden border border-[#1d2b3d] bg-[#05070d] shadow-2xl">
      <div className="h-[58px] px-4 md:px-5 flex items-center gap-3 border-b border-[#172536] bg-[#070b12]">
        <div className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold shadow-lg" style={{ background: colors.primary }}>Q</div>
        <div className="min-w-0">
          <div className="text-[12px] text-slate-200 font-semibold truncate">Learner course preview</div>
          <div className="text-[10px] text-slate-500">Screen experience · responsive approximation</div>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 w-[180px]"><div className="h-1.5 bg-[#142033] rounded-full overflow-hidden flex-1"><div className="h-full w-[42%] rounded-full" style={{ background: `linear-gradient(90deg,${colors.primary},${colors.accent})` }} /></div><span className="text-[10px] text-slate-500">42%</span></div>
      </div>

      <div className="p-4 md:p-6 bg-[radial-gradient(circle_at_80%_0%,rgba(37,99,235,.08),transparent_24rem)]">
        <div className="grid lg:grid-cols-[.68fr_1.32fr] gap-4 md:gap-5 items-stretch">
          <section className="rounded-[22px] border border-[#1e2f44] bg-[#0b111b] p-5 md:p-6 flex flex-col justify-center min-w-0">
            <div className="text-[10px] uppercase tracking-[.13em] font-bold mb-2" style={{ color: colors.accent }}>Section · {slide.layout}</div>
            <h2 className="text-[28px] md:text-[34px] font-semibold tracking-[-.04em] leading-[1.04] text-slate-50 text-balance">{slide.title}</h2>
            <p className="text-[14px] md:text-[15px] text-slate-300 mt-4 leading-[1.65]">{slide.content}</p>
            {points.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{points.map((_, i) => <button type="button" key={i} className="rounded-xl border border-[#29405d] bg-[#0e1a2a] px-3 py-2 text-[11px] font-semibold text-slate-300">{slide.layout === 'process' ? `Step ${i + 1}` : slide.layout === 'timeline' ? `Stage ${i + 1}` : `Point ${i + 1}`}</button>)}</div>}
            <div className="mt-3 rounded-xl border border-[#243852] bg-[#101c2c] px-3.5 py-3 text-[12px] leading-relaxed text-slate-300">{slide.interaction?.prompt}</div>
          </section>

          <section className="rounded-[22px] border border-slate-200 bg-[#f7f9fc] p-3 md:p-5 min-h-[430px] flex items-center justify-center overflow-hidden">
            <div className="w-full"><PreviewVisual slide={slide} colors={colors} /></div>
          </section>
        </div>
      </div>

      <div className="h-[62px] border-t border-[#172536] bg-[#070b12] px-4 md:px-5 flex items-center justify-between gap-3">
        <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-[#283a50] bg-[#0a131f] px-3.5 py-2 text-[11px] font-semibold text-slate-400"><ChevronLeft size={14} /> Previous</button>
        <span className="text-[10px] uppercase tracking-[.1em] font-semibold text-slate-500">Learner navigation</span>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-semibold text-white" style={{ background: colors.primary }}>Continue <ChevronRight size={14} /></button>
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
  const fitIssues = slide ? visualFitIssues(slide) : [];

  return (
    <div className="min-h-screen p-4 md:p-7 max-w-[1540px] mx-auto relative z-10 pb-24">
      <div className="flex flex-wrap justify-between gap-4 items-start mb-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">SCORM World · Authoring</div>
          <h1 className="text-3xl md:text-[36px] font-semibold tracking-[-.045em] mt-1">Visual Studio</h1>
          <p className="text-sm mt-2 max-w-2xl">Edit generated learning content, control the visual layout and preview the learner experience before rebuilding the package.</p>
        </div>
        {analysis && <button type="button" disabled={busy} onClick={save} className="scorm-button-primary px-5 py-3 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50"><Sparkles size={16} />{busy ? 'Rebuilding…' : 'Save & rebuild package'}</button>}
      </div>

      {error && <div className="scorm-alert-danger mb-5 rounded-xl border p-3 text-sm">{error}</div>}
      {saved && <div className="mb-5 rounded-xl bg-[#0b1f2d] border border-[#24455c] p-3 text-sm text-[#b9d7e7] inline-flex items-center gap-2"><Check size={15} />{saved}</div>}

      {!packageId && (
        <div className="scorm-panel rounded-3xl border p-6">
          <div className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500 mb-4">Choose an AI-authored package</div>
          <div className="grid md:grid-cols-2 gap-3">
            {packages.filter((p) => p.source === 'ai_author').map((p) => (
              <button key={p.id} type="button" onClick={() => setSearchParams({ edit: p.id })} className="text-left rounded-2xl border border-[#26374d] bg-[#0a131f] hover:bg-[#101d2c] p-4 transition-colors">
                <div className="font-semibold">{p.title}</div>
                <div className="text-xs text-slate-500 mt-1">{p.standard || 'SCORM 1.2'} · {p.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {packageId && busy && !analysis && <div className="scorm-panel rounded-3xl border p-10 text-center text-slate-400">Loading visual blueprint…</div>}

      {analysis && slide && (
        <div className="grid xl:grid-cols-[240px_minmax(0,1fr)_360px] gap-4 items-start">
          <aside className="scorm-panel rounded-3xl border p-3 xl:sticky xl:top-24 max-h-[78vh] overflow-auto">
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500 px-2 py-2">Screens</div>
            {analysis.slides.map((s, i) => (
              <button key={i} type="button" onClick={() => setSelected(i)} className={`w-full text-left rounded-xl px-3 py-3 mb-1 border transition-colors ${selected === i ? 'bg-[#122541] text-white border-[#315a8b]' : 'bg-transparent text-slate-300 border-transparent hover:bg-[#0d1928]'}`}>
                <div className="text-[9px] uppercase tracking-[.11em] opacity-55 font-semibold">{String(i + 1).padStart(2, '0')} · {s.layout}</div>
                <div className="text-xs font-semibold truncate mt-1">{s.title}</div>
              </button>
            ))}
          </aside>

          <main className="min-w-0"><Preview slide={slide} theme={templateId} /></main>

          <aside className="scorm-panel rounded-3xl border p-4 space-y-4 xl:sticky xl:top-24 max-h-[78vh] overflow-auto">
            {fitIssues.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold"><AlertTriangle size={15} />Visual fit</div>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-amber-100/75 list-disc pl-4">{fitIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Screen title</label>
              <input value={slide.title || ''} onChange={(e) => updateSlide({ title: e.target.value })} className="w-full p-2.5 text-sm" />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Body content</label>
              <textarea rows={6} value={slide.content || ''} onChange={(e) => updateSlide({ content: e.target.value })} className="w-full p-2.5 text-sm leading-relaxed" />
              <div className="mt-1.5 text-[10px] text-slate-500">{wordCount(slide.content)} words · ideal roughly 45–95 for one screen</div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Visual points</label>
              <textarea rows={6} value={(slide.keyPoints || []).join('\n')} onChange={(e) => updateSlide({ keyPoints: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} className="w-full p-2.5 text-sm leading-relaxed" placeholder="One concise visual point per line" />
              <div className="mt-1.5 text-[10px] text-slate-500">One point per line · recommended max {POINT_WORD_LIMITS[slide.layout] || 11} words each</div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Layout</label>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUTS.map(([id, label]) => <button key={id} type="button" onClick={() => updateSlide({ layout: id })} className={`rounded-xl px-2 py-2 text-[11px] font-semibold border ${slide.layout === id ? 'bg-[#173b73] text-white border-[#3b82f6]' : 'bg-[#0a131f] text-slate-400 border-[#26374d] hover:border-[#38516f]'}`}>{label}</button>)}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Visual title</label>
              <input value={slide.visualTitle || ''} onChange={(e) => updateSlide({ visualTitle: e.target.value })} className="w-full p-2.5 text-sm" />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Interaction prompt</label>
              <textarea rows={3} value={slide.interaction?.prompt || ''} onChange={(e) => updateSlide({ interaction: { ...(slide.interaction || {}), prompt: e.target.value } })} className="w-full p-2.5 text-sm" />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Theme accent</label>
              <select value={templateId} onChange={(e) => { setTemplateId(Number(e.target.value)); setSaved('Unsaved changes'); }} className="w-full p-2.5 text-sm">{THEMES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            </div>

            <div className="rounded-xl bg-[#08111c] border border-[#21334a] p-3 text-[11px] text-slate-500 leading-relaxed">The final package uses Python-generated SVG vectors. This preview now mirrors the final dark learner shell, spacing and visual proportions; the exact vector artwork is produced when the package is rebuilt.</div>
          </aside>
        </div>
      )}
    </div>
  );
}
