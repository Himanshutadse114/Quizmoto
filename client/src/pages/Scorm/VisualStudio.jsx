import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Monitor, Smartphone, Sparkles, Tablet } from 'lucide-react';
import { apiUrl } from '../../config';
import {
  BACKGROUND_STYLES,
  COURSE_LAYOUTS,
  COURSE_THEMES,
  METAPHORS,
  SCREEN_TYPES,
  courseTheme,
  normalizeCourseSlide,
  visualFitIssues,
  wordCount
} from './courseExperienceV5';

const DEVICES = [
  ['desktop', 'Desktop', Monitor],
  ['tablet', 'Tablet', Tablet],
  ['mobile', 'Mobile', Smartphone]
];

const PREVIEW_WIDTHS = {
  desktop: 820,
  tablet: 620,
  mobile: 360
};

function ArtworkCard({ point, index, theme, compact = false }) {
  return (
    <div className="rounded-xl border border-white/10 flex items-center gap-2.5" style={{ background: `linear-gradient(145deg,${theme.visual},${theme.surface})`, padding: compact ? '8px' : '10px' }}>
      <span className="shrink-0 rounded-lg flex items-center justify-center text-white font-bold" style={{ width: compact ? 25 : 29, height: compact ? 25 : 29, fontSize: compact ? 9 : 10, background: theme.primary }}>{index + 1}</span>
      <span className="text-white/75 font-semibold leading-snug" style={{ fontSize: compact ? 9.5 : 11 }}>{point}</span>
    </div>
  );
}

function PreviewArtwork({ slide, theme, mobile }) {
  const points = (slide.keyPoints || []).filter(Boolean).slice(0, 6);
  const layout = slide.layout || 'cards';

  if (layout === 'comparison') {
    const half = Math.max(1, Math.ceil(points.length / 2));
    const groups = [
      ['Recommended', '#34D399', '✓', points.slice(0, half)],
      ['Watch out', '#FB7185', '!', points.slice(half).length ? points.slice(half) : ['Pause and verify before acting.']]
    ];
    return (
      <div className={`grid ${mobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5 w-full`}>
        {groups.map(([label, color, mark, list]) => (
          <div key={label} className="rounded-2xl border border-white/10 p-3" style={{ background: `${theme.surface}DD`, borderTop: `4px solid ${color}` }}>
            <div className="text-[9px] uppercase tracking-[.12em] font-bold mb-2.5" style={{ color }}>{label}</div>
            {list.slice(0, 3).map((p, i) => <div key={i} className="flex gap-2 items-start mb-2 text-white/70 text-[10px] leading-snug"><span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: color }}>{mark}</span><span>{p}</span></div>)}
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'matrix') {
    return <div className="grid grid-cols-2 gap-2 w-full">{['#10B981', '#F59E0B', '#F59E0B', '#F43F5E'].map((color, i) => <div key={i} className="rounded-xl border p-2.5 min-h-[88px]" style={{ borderColor: `${color}66`, background: `${theme.surface}DD` }}><div className="text-[8px] uppercase tracking-[.1em] font-bold" style={{ color }}>{i === 0 ? 'Lower' : i === 3 ? 'Higher' : 'Watch'}</div><div className="text-white/75 text-[10px] font-semibold mt-2 leading-snug">{points[i] || 'Risk signal'}</div></div>)}</div>;
  }

  if (layout === 'hub') {
    return (
      <div className="w-full flex flex-col items-center gap-3">
        <div className={`${mobile ? 'w-28 h-28' : 'w-28 h-28'} rounded-full flex items-center justify-center text-center text-white font-semibold p-3 shadow-2xl`} style={{ background: `radial-gradient(circle at 30% 20%,${theme.accent},transparent 45%),linear-gradient(145deg,${theme.primary},${theme.dark})` }}><div><div className="text-[8px] uppercase tracking-[.1em] opacity-60 mb-1">{slide.visualMetaphor}</div><div className="text-[12px] leading-tight">{slide.visualTitle}</div></div></div>
        <div className="grid grid-cols-2 gap-2 w-full">{points.slice(0, 4).map((p, i) => <ArtworkCard key={i} point={p} index={i} theme={theme} compact={mobile} />)}</div>
      </div>
    );
  }

  if (layout === 'spotlight') {
    return <div className="w-full min-h-[220px] flex flex-col items-center justify-center text-center"><div className="w-28 h-28 rounded-full flex items-center justify-center shadow-2xl" style={{ background: `radial-gradient(circle at 30% 20%,${theme.accent},transparent 43%),linear-gradient(145deg,${theme.primary},${theme.dark})` }}><div className="text-4xl text-white">!</div></div><div className="text-white text-lg font-semibold mt-4">{slide.visualTitle}</div><div className="text-white/55 text-[10px] mt-2 max-w-xs">{points[0]}</div></div>;
  }

  if (layout === 'process' || layout === 'timeline' || layout === 'cycle') {
    return (
      <div className={`w-full flex ${mobile ? 'flex-col' : 'flex-row'} items-stretch gap-2`}>
        {points.slice(0, mobile ? 5 : 4).map((p, i) => <React.Fragment key={i}><div className={`${mobile ? 'w-full' : 'flex-1'} relative`}><ArtworkCard point={p} index={i} theme={theme} compact={mobile} /></div>{i < Math.min(points.length, mobile ? 5 : 4) - 1 && <div className={`flex items-center justify-center font-bold ${mobile ? 'h-3' : 'w-3'}`} style={{ color: theme.accent }}>{mobile ? '↓' : '→'}</div>}</React.Fragment>)}
      </div>
    );
  }

  return <div className="grid grid-cols-2 gap-2 w-full">{points.slice(0, 6).map((p, i) => <ArtworkCard key={i} point={p} index={i} theme={theme} compact={mobile} />)}</div>;
}

function CoursePreview({ slide, themeId, device }) {
  const theme = courseTheme(themeId);
  const mobile = device === 'mobile';
  const tablet = device === 'tablet';
  const width = PREVIEW_WIDTHS[device] || PREVIEW_WIDTHS.desktop;
  const points = (slide.keyPoints || []).filter(Boolean).slice(0, 6);
  const visualHeight = mobile ? 'min-h-[330px]' : tablet ? 'min-h-[270px]' : 'min-h-[285px]';

  return (
    <div className="mx-auto w-full transition-[max-width] duration-300" style={{ maxWidth: width }}>
      <div className={`overflow-hidden border border-white/10 shadow-2xl ${mobile ? 'rounded-[25px]' : 'rounded-[18px]'}`} style={{ background: `linear-gradient(165deg,${theme.bg2},${theme.bg})` }}>
        <div className={`${mobile ? 'h-12 px-3' : 'h-12 px-4'} flex items-center gap-2.5 border-b border-white/10`}>
          <div className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-xs" style={{ background: `linear-gradient(145deg,${theme.primary},${theme.dark})` }}>Q</div>
          {!mobile && <div className="min-w-0"><div className="text-[10px] text-white font-semibold truncate">Learner course</div><div className="text-[8px] text-white/35">Course Experience V5</div></div>}
          <div className="ml-auto flex items-center gap-2"><div className={`${mobile ? 'w-20' : 'w-28'} h-1.5 bg-white/10 rounded-full overflow-hidden`}><div className="w-[42%] h-full rounded-full" style={{ background: `linear-gradient(90deg,${theme.primary},${theme.accent})` }} /></div>{!mobile && <span className="text-[8px] text-white/35">42%</span>}</div>
        </div>

        <div className={`${mobile ? 'p-3' : 'p-3.5'} relative`} style={{ background: `radial-gradient(circle at 78% 15%,${theme.primary}18,transparent 36%),linear-gradient(160deg,${theme.bg2},${theme.bg})` }}>
          <div className={`grid ${mobile || tablet ? 'grid-cols-1' : 'grid-cols-[.76fr_1.24fr]'} gap-3`}>
            <section className={`rounded-[15px] border border-white/10 ${mobile ? 'p-4' : 'p-4'} flex flex-col justify-center`} style={{ background: theme.surface }}>
              <div className="text-[8px] uppercase tracking-[.13em] font-bold mb-1.5" style={{ color: theme.accent }}>{slide.screenType} · {slide.layout}</div>
              <h2 className={`${mobile ? 'text-[23px]' : 'text-[25px]'} font-semibold tracking-[-.04em] leading-[1.02] text-white`}>{slide.title}</h2>
              <p className={`${mobile ? 'text-[12px]' : 'text-[11px]'} text-white/65 mt-2.5 leading-[1.5]`}>{slide.introText || slide.content}</p>
            </section>

            <section className={`rounded-[15px] border border-white/10 relative overflow-hidden flex items-center justify-center p-3.5 ${visualHeight}`} style={{ background: `radial-gradient(circle at 75% 15%,${theme.accent}24,transparent 40%),linear-gradient(145deg,${theme.visual},${theme.bg2})` }}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: slide.backgroundStyle === 'grid' ? `linear-gradient(${theme.accent}22 1px,transparent 1px),linear-gradient(90deg,${theme.accent}22 1px,transparent 1px)` : 'none', backgroundSize: '26px 26px' }} />
              <div className="relative w-full"><PreviewArtwork slide={slide} theme={theme} mobile={mobile} /></div>
              <div className="absolute left-2.5 bottom-2.5 rounded-lg border border-white/10 bg-black/30 backdrop-blur px-2 py-1 text-[7px] uppercase tracking-[.08em] text-white/50">Vector preview</div>
            </section>

            <section className={`${mobile || tablet ? '' : 'col-start-1'} rounded-[14px] border border-white/10 p-3`} style={{ background: `${theme.surface}CC` }}>
              <div className="text-[9px] text-white/45 mb-2 line-clamp-2">{slide.interaction?.prompt}</div>
              <div className="grid grid-cols-2 gap-1.5">{points.slice(0, 4).map((_, i) => <button type="button" key={i} className="rounded-lg border border-white/10 min-h-[36px] px-2 text-[9px] text-white/70 text-left" style={{ background: `${theme.primary}18` }}><span className="inline-flex w-4 h-4 rounded items-center justify-center mr-1 text-[7px] text-white" style={{ background: theme.primary }}>{i + 1}</span>{slide.layout === 'process' ? `Step ${i + 1}` : 'Explore'}</button>)}</div>
              {!!slide.revealText && <div className="mt-2 rounded-lg border border-white/10 px-2.5 py-2 text-[9px] leading-relaxed text-white/45">Detail appears here after interaction.</div>}
            </section>
          </div>
        </div>

        <div className={`${mobile ? 'h-14 px-3' : 'h-12 px-4'} border-t border-white/10 flex items-center justify-between gap-2`}><button type="button" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] text-white/50"><ChevronLeft size={11} className="inline mr-1" />Previous</button><span className="text-[8px] text-white/30">Part 3 of 8</span><button type="button" className="rounded-lg px-2.5 py-1.5 text-[9px] text-white font-semibold" style={{ background: theme.primary }}>Continue <ChevronRight size={11} className="inline ml-1" /></button></div>
      </div>
      {!mobile && <div className="mx-auto h-2.5 w-[64%] rounded-b-xl border-x border-b border-white/10 bg-white/[.035]" />}
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
  const [themeId, setThemeId] = useState(1);
  const [selected, setSelected] = useState(0);
  const [device, setDevice] = useState('desktop');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    axios.get(apiUrl('/api/scorm/packages'), { headers }).then((r) => setPackages(r.data || [])).catch(() => {});
  }, [token, headers, navigate]);

  useEffect(() => {
    if (!packageId) { setAnalysis(null); return; }
    setBusy(true); setError('');
    axios.get(apiUrl(`/api/scorm/packages/${packageId}/analysis`), { headers })
      .then((res) => {
        const data = res.data.analysis || {};
        setAnalysis({ ...data, slides: (data.slides || []).map(normalizeCourseSlide) });
        setThemeId(Number(res.data.templateId) || Number(data.themeId) || 1);
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
    setBusy(true); setError(''); setSaved('');
    try {
      await axios.post(apiUrl('/api/scorm/author/generate'), {
        analysis: { ...analysis, themeId, themeName: courseTheme(themeId).name },
        templateId: themeId,
        replacePackageId: packageId
      }, { headers, timeout: 180000 });
      setSaved('Course Experience V5 rebuilt successfully');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };

  const slide = analysis?.slides?.[selected];
  const issues = visualFitIssues(slide);

  return (
    <div className="min-h-screen p-4 md:p-7 max-w-[1580px] mx-auto relative z-10 pb-24">
      <div className="flex flex-wrap justify-between gap-4 items-start mb-6">
        <div><div className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">SCORM World · Course Experience V5</div><h1 className="text-3xl md:text-[38px] font-semibold tracking-[-.05em] mt-1">Visual Studio</h1><p className="text-sm mt-2 max-w-2xl text-slate-400">Edit each learning screen in a compact fit-to-workspace preview. The generated course keeps its full desktop and mobile resolution.</p></div>
        {analysis && <button type="button" disabled={busy} onClick={save} className="scorm-button-primary px-5 py-3 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50"><Sparkles size={16} />{busy ? 'Rebuilding…' : 'Save & rebuild package'}</button>}
      </div>

      {error && <div className="scorm-alert-danger mb-5 rounded-xl border p-3 text-sm">{error}</div>}
      {saved && <div className="mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-sm text-emerald-100 inline-flex items-center gap-2"><Check size={15} />{saved}</div>}

      {!packageId && <div className="scorm-panel rounded-3xl border p-6"><div className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500 mb-4">Choose an AI-authored package</div><div className="grid md:grid-cols-2 gap-3">{packages.filter((p) => p.source === 'ai_author').map((p) => <button key={p.id} type="button" onClick={() => setSearchParams({ edit: p.id })} className="text-left rounded-2xl border border-[#26374d] bg-[#0a131f] hover:bg-[#101d2c] p-4"><div className="font-semibold">{p.title}</div><div className="text-xs text-slate-500 mt-1">{p.standard || 'SCORM 1.2'} · {p.status}</div></button>)}</div></div>}
      {packageId && busy && !analysis && <div className="scorm-panel rounded-3xl border p-10 text-center text-slate-400">Loading course experience…</div>}

      {analysis && slide && (
        <div className="grid xl:grid-cols-[210px_minmax(0,1fr)_340px] gap-4 items-start">
          <aside className="scorm-panel rounded-3xl border p-3 xl:sticky xl:top-20 max-h-[82vh] overflow-auto">
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500 px-2 py-2">Learning experiences</div>
            {analysis.slides.map((item, i) => <button key={i} type="button" onClick={() => setSelected(i)} className={`w-full text-left rounded-xl px-3 py-3 mb-1 border ${selected === i ? 'bg-[#122541] text-white border-[#315a8b]' : 'bg-transparent text-slate-300 border-transparent hover:bg-[#0d1928]'}`}><div className="text-[9px] uppercase tracking-[.11em] opacity-55 font-semibold">{String(i + 1).padStart(2, '0')} · {item.screenType || item.layout}</div><div className="text-xs font-semibold truncate mt-1">{item.title}</div></button>)}
          </aside>

          <main className="min-w-0 space-y-3">
            <div className="flex flex-wrap justify-between gap-3 items-center scorm-panel rounded-2xl border p-3">
              <div className="flex gap-2">{DEVICES.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setDevice(id)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold inline-flex items-center gap-1.5 ${device === id ? 'bg-[#173b73] border-[#3b82f6] text-white' : 'bg-[#0a131f] border-[#26374d] text-slate-400'}`}><Icon size={14} />{label}</button>)}</div>
              <div className="text-[10px] text-slate-500">Fit preview · {PREVIEW_WIDTHS[device]}px canvas</div>
            </div>
            <div className="scorm-panel rounded-2xl border p-3 md:p-4 overflow-hidden">
              <CoursePreview slide={slide} themeId={themeId} device={device} />
            </div>
          </main>

          <aside className="scorm-panel rounded-3xl border p-4 space-y-4 xl:sticky xl:top-20 max-h-[82vh] overflow-auto">
            {issues.length > 0 && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5"><div className="flex items-center gap-2 text-amber-200 text-xs font-semibold"><AlertTriangle size={15} />Experience fit</div><ul className="mt-2 space-y-1.5 text-[11px] text-amber-100/75 list-disc pl-4">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}

            <div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Course theme</label><div className="grid grid-cols-4 gap-2">{COURSE_THEMES.map((theme) => <button key={theme.id} type="button" onClick={() => { setThemeId(theme.id); setSaved('Unsaved changes'); }} title={theme.name} className={`h-11 rounded-xl border-2 ${themeId === theme.id ? 'border-white' : 'border-white/10'}`} style={{ background: `linear-gradient(145deg,${theme.primary},${theme.accent})` }} />)}</div><div className="text-[10px] text-slate-500 mt-1.5">{courseTheme(themeId).name}</div></div>
            <div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Screen title</label><input value={slide.title || ''} onChange={(e) => updateSlide({ title: e.target.value })} className="w-full p-2.5 text-sm" /></div>
            <div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Screen type</label><select value={slide.screenType || 'concept'} onChange={(e) => updateSlide({ screenType: e.target.value })} className="w-full p-2.5 text-sm">{SCREEN_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Initial context</label><textarea rows={4} value={slide.introText || ''} onChange={(e) => updateSlide({ introText: e.target.value })} className="w-full p-2.5 text-sm leading-relaxed" /><div className="mt-1 text-[10px] text-slate-500">{wordCount(slide.introText)} words</div></div>
            <div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Progressive reveal</label><textarea rows={5} value={slide.revealText || ''} onChange={(e) => updateSlide({ revealText: e.target.value })} className="w-full p-2.5 text-sm leading-relaxed" /></div>
            <div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Visual labels</label><textarea rows={5} value={(slide.keyPoints || []).join('\n')} onChange={(e) => updateSlide({ keyPoints: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} className="w-full p-2.5 text-sm" /></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Layout</label><select value={slide.layout} onChange={(e) => updateSlide({ layout: e.target.value })} className="w-full p-2.5 text-xs">{COURSE_LAYOUTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Background</label><select value={slide.backgroundStyle || 'mesh'} onChange={(e) => updateSlide({ backgroundStyle: e.target.value })} className="w-full p-2.5 text-xs">{BACKGROUND_STYLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Metaphor</label><select value={slide.visualMetaphor || 'shield'} onChange={(e) => updateSlide({ visualMetaphor: e.target.value })} className="w-full p-2.5 text-xs">{METAPHORS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div><div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Visual title</label><input value={slide.visualTitle || ''} onChange={(e) => updateSlide({ visualTitle: e.target.value })} className="w-full p-2.5 text-xs" /></div></div>
            <div><label className="block text-[10px] font-semibold uppercase tracking-[.11em] text-slate-500 mb-2">Interaction prompt</label><textarea rows={3} value={slide.interaction?.prompt || ''} onChange={(e) => updateSlide({ interaction: { ...(slide.interaction || {}), prompt: e.target.value } })} className="w-full p-2.5 text-sm" /></div>
            <div className="rounded-xl bg-[#08111c] border border-[#21334a] p-3 text-[11px] text-slate-500 leading-relaxed">The studio preview is intentionally smaller than the exported course so every slide remains visible while editing. Generated packages still use full responsive desktop and mobile artwork.</div>
          </aside>
        </div>
      )}
    </div>
  );
}
