import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Monitor,
  RefreshCw,
  Smartphone,
  Sparkles,
  Tablet,
  Type
} from 'lucide-react';
import { apiUrl } from '../../config';
import {
  COURSE_LAYOUTS,
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
  desktop: 1040,
  tablet: 720,
  mobile: 410
};

function svgDataUrl(svg) {
  if (!svg) return '';
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function editorLabel(text) {
  return <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500 mb-2">{text}</div>;
}

function GammaCoursePreview({ analysis, slide, svg, device, loading, sceneSpec }) {
  const mobile = device === 'mobile';
  const tablet = device === 'tablet';
  const width = PREVIEW_WIDTHS[device] || PREVIEW_WIDTHS.desktop;
  const points = (slide.keyPoints || []).filter(Boolean).slice(0, 4);
  const title = String(slide.title || 'Untitled screen');
  const longTitle = title.length > 58 || wordCount(title) > 8;
  const imageUrl = svgDataUrl(svg);
  const progress = Math.max(8, Math.round(((Number(slide.__index || 0) + 1) / Math.max(1, analysis.slides?.length || 1)) * 100));

  return (
    <div className="mx-auto w-full transition-[max-width] duration-300" style={{ maxWidth: width }}>
      <div className="overflow-hidden border border-[#c9c5bb] bg-[#E7E7E4] shadow-[0_22px_70px_rgba(0,0,0,.24)]" style={{ borderRadius: mobile ? 24 : 12 }}>
        <div className="h-14 px-4 md:px-5 flex items-center gap-3 border-b border-[#CBC5B8] bg-[#E7E7E4]">
          <div className="w-8 h-8 rounded-[7px] bg-[#282824] text-white flex items-center justify-center text-[11px] font-black">Q</div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[#282824] truncate">{analysis.title || 'AI Course'}</div>
            <div className="text-[9px] text-[#77776F]">Gamma Editorial · Smart SVG</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!mobile && <span className="text-[9px] font-bold text-[#77776F]">{progress}%</span>}
            <div className={`${mobile ? 'w-16' : 'w-24'} h-1.5 rounded-full bg-[#CBC5B8] overflow-hidden`}>
              <div className="h-full bg-[#282824] rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className={`${mobile ? 'p-4' : tablet ? 'p-5' : 'p-7'} bg-[#E7E7E4]`}>
          <div className={`grid ${mobile || tablet ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.42fr)_minmax(360px,1fr)]'} gap-5 md:gap-7 items-center`}>
            <section className={`${mobile ? 'order-1' : ''} min-w-0 py-2`}>
              <div className="text-[9px] uppercase tracking-[.09em] font-black text-[#4A4A45] mb-3">{slide.screenType || 'concept'} · {slide.layout || 'cards'}</div>
              <h2
                className="font-black text-[#282824] tracking-[-.035em] leading-[1.03] m-0"
                style={{ fontFamily: 'Lato, Arial, sans-serif', fontSize: mobile ? (longTitle ? 28 : 32) : longTitle ? 36 : 44, maxWidth: '20ch' }}
              >
                {title}
              </h2>
              <p className="mt-4 text-[#4A4A45] leading-[1.55] max-w-[54ch]" style={{ fontSize: mobile ? 14 : 15.5 }}>
                {slide.introText || slide.content || 'Add concise learner context for this screen.'}
              </p>

              {!!points.length && (
                <div className={`mt-5 grid ${mobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                  {points.map((point, index) => (
                    <div key={`${point}-${index}`} className="min-h-11 rounded-lg border border-[#CBC5B8] bg-[#E5DFD2] px-3 py-2.5 flex gap-2 items-start text-[11px] font-bold leading-snug text-[#282824]">
                      <span className="w-5 h-5 shrink-0 rounded-md bg-[#282824] text-white flex items-center justify-center text-[8px] font-black">{index + 1}</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              )}

              {!!slide.revealText && (
                <div className="mt-3 rounded-lg border border-[#CBC5B8] border-l-4 border-l-[#282824] bg-[#E5DFD2] px-3.5 py-3 text-[11px] leading-relaxed text-[#4A4A45]">
                  <span className="font-black text-[#282824]">After interaction · </span>{slide.revealText}
                </div>
              )}
            </section>

            <section className={`${mobile || tablet ? 'order-2' : ''} relative border border-[#CBC5B8] bg-[#E5DFD2] p-3 md:p-4 flex items-center justify-center overflow-hidden`} style={{ aspectRatio: mobile ? '3 / 4' : '8 / 5' }}>
              {loading && <div className="absolute inset-0 z-10 bg-[#E5DFD2]/80 flex items-center justify-center text-[11px] font-bold text-[#4A4A45]"><RefreshCw size={15} className="mr-2 animate-spin" />Rendering Smart SVG…</div>}
              {imageUrl ? (
                <img src={imageUrl} alt={slide.visualTitle || slide.title || 'Learning visual'} className="w-full h-full object-contain object-center" />
              ) : (
                <div className="text-center text-[#77776F] px-5"><ImageIcon size={28} className="mx-auto mb-3" /><div className="text-xs font-bold">Smart SVG preview</div><div className="text-[10px] mt-1">The server-rendered visual will appear here.</div></div>
              )}
              <div className="absolute left-3 bottom-3 rounded-md bg-[#282824]/90 text-white px-2 py-1 text-[8px] font-bold tracking-[.06em] uppercase">{sceneSpec?.scene || 'Smart SVG'}</div>
            </section>
          </div>
        </div>

        <div className="h-14 px-4 md:px-5 flex items-center justify-between border-t border-[#CBC5B8] bg-[#E7E7E4]">
          <button type="button" className="rounded-lg border border-[#CBC5B8] px-3 py-2 text-[10px] font-bold text-[#282824] bg-transparent"><ChevronLeft size={12} className="inline mr-1" />Previous</button>
          <span className="text-[9px] font-bold text-[#77776F]">Learner preview</span>
          <button type="button" className="rounded-lg border border-[#282824] bg-[#282824] text-white px-3 py-2 text-[10px] font-bold">Continue <ChevronRight size={12} className="inline ml-1" /></button>
        </div>
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
  const [selected, setSelected] = useState(0);
  const [device, setDevice] = useState('desktop');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [previewSvg, setPreviewSvg] = useState('');
  const [previewSpec, setPreviewSpec] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewNonce, setPreviewNonce] = useState(0);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    axios.get(apiUrl('/api/scorm/packages'), { headers }).then((r) => setPackages(r.data || [])).catch(() => {});
  }, [token, headers, navigate]);

  useEffect(() => {
    if (!packageId) { setAnalysis(null); return; }
    setBusy(true); setError('');
    axios.get(apiUrl(`/api/scorm/packages/${packageId}/analysis`), { headers })
      .then((res) => {
        const data = res.data.analysis || {};
        setAnalysis({ ...data, themeId: 1, themeName: 'Gamma Editorial', slides: (data.slides || []).map(normalizeCourseSlide) });
        setSelected(0);
      })
      .catch((err) => setError(err.response?.data?.message || err.message))
      .finally(() => setBusy(false));
  }, [packageId, headers]);

  const slide = analysis?.slides?.[selected];

  const renderPreview = useCallback(async () => {
    if (!analysis || !slide) return;
    setPreviewBusy(true);
    setPreviewError('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/visual-studio/render'), {
        analysis: { title: analysis.title, visualTheme: analysis.visualTheme || {}, themeId: 1 },
        slide,
        index: selected,
        device
      }, { headers, timeout: 30000 });
      setPreviewSvg(res.data?.svg || '');
      setPreviewSpec(res.data?.sceneSpec || null);
    } catch (err) {
      setPreviewError(err.response?.data?.message || 'Unable to render Smart SVG preview.');
    } finally {
      setPreviewBusy(false);
    }
  }, [analysis, slide, selected, device, headers]);

  useEffect(() => {
    if (!analysis || !slide) return undefined;
    const timer = window.setTimeout(renderPreview, 280);
    return () => window.clearTimeout(timer);
  }, [analysis, slide, selected, device, previewNonce, renderPreview]);

  const updateSlide = (patch) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
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
        analysis: { ...analysis, themeId: 1, themeName: 'Gamma Editorial' },
        templateId: 1,
        replacePackageId: packageId
      }, { headers, timeout: 180000 });
      setSaved('Gamma Editorial course rebuilt successfully');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };

  const issues = visualFitIssues(slide);
  const template = courseTheme(1);

  return (
    <div className="min-h-screen p-4 md:p-6 2xl:p-7 max-w-[1760px] mx-auto relative z-10 pb-24">
      <div className="flex flex-wrap justify-between gap-4 items-start mb-5">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">SCORM AI · Gamma Editorial</div>
          <h1 className="text-3xl md:text-[38px] font-semibold tracking-[-.05em] mt-1">Visual Studio</h1>
          <p className="text-sm mt-2 max-w-3xl text-slate-400">Edit the learner screen while previewing the same Smart SVG renderer used in the exported SCORM package. Artwork is fitted without cropping.</p>
        </div>
        {analysis && (
          <div className="flex gap-2 items-center">
            <button type="button" onClick={() => setPreviewNonce((v) => v + 1)} className="scorm-button-secondary px-4 py-3 text-xs font-semibold inline-flex items-center gap-2"><RefreshCw size={14} />Refresh visual</button>
            <button type="button" disabled={busy} onClick={save} className="scorm-button-primary px-5 py-3 font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-50"><Sparkles size={16} />{busy ? 'Rebuilding…' : 'Save & rebuild'}</button>
          </div>
        )}
      </div>

      {error && <div className="scorm-alert-danger mb-5 rounded-xl border p-3 text-sm">{error}</div>}
      {saved && <div className="mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 text-sm text-emerald-100 inline-flex items-center gap-2"><Check size={15} />{saved}</div>}

      {!packageId && (
        <div className="scorm-panel rounded-3xl border p-6">
          <div className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500 mb-4">Choose an AI-authored course</div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {packages.filter((p) => p.source === 'ai_author').map((p) => (
              <button key={p.id} type="button" onClick={() => setSearchParams({ edit: p.id })} className="text-left rounded-2xl border border-[#29423f] bg-[#0c1614] hover:bg-[#11201d] p-4">
                <div className="font-semibold">{p.title}</div>
                <div className="text-xs text-slate-500 mt-1">Gamma Editorial · {p.standard || 'SCORM 1.2'} · {p.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {packageId && busy && !analysis && <div className="scorm-panel rounded-3xl border p-10 text-center text-slate-400">Loading course experience…</div>}

      {analysis && slide && (
        <div className="grid xl:grid-cols-[250px_minmax(620px,1fr)_320px] 2xl:grid-cols-[270px_minmax(720px,1fr)_340px] gap-4 items-start">
          <aside className="scorm-panel rounded-3xl border p-3 xl:sticky xl:top-20 max-h-[82vh] overflow-auto">
            <div className="flex items-center justify-between px-2 py-2 mb-1">
              <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Screens</div>
              <div className="text-[10px] text-slate-600">{analysis.slides.length}</div>
            </div>
            {analysis.slides.map((item, i) => {
              const itemIssues = visualFitIssues(item);
              return (
                <button key={i} type="button" onClick={() => setSelected(i)} className={`w-full text-left rounded-xl px-3 py-3 mb-1 border transition-colors ${selected === i ? 'bg-[#15302c] text-white border-[#4FC9BF]/50' : 'bg-transparent text-slate-300 border-transparent hover:bg-[#10211e]'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[.11em] opacity-55 font-semibold">{String(i + 1).padStart(2, '0')} · {item.screenType || item.layout}</span>
                    {itemIssues.length > 0 && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" title={`${itemIssues.length} fit issue(s)`} />}
                  </div>
                  <div className="text-xs font-semibold leading-snug mt-1.5 line-clamp-2">{item.title}</div>
                </button>
              );
            })}
          </aside>

          <main className="min-w-0 space-y-3">
            <div className="flex flex-wrap justify-between gap-3 items-center scorm-panel rounded-2xl border p-3">
              <div className="flex gap-2">
                {DEVICES.map(([id, label, Icon]) => (
                  <button key={id} type="button" onClick={() => setDevice(id)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold inline-flex items-center gap-1.5 ${device === id ? 'bg-[#16302c] border-[#4FC9BF]/60 text-[#D8FFFB]' : 'bg-[#0c1614] border-[#29423f] text-slate-400'}`}><Icon size={14} />{label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-[#4FC9BF]" />Live Smart SVG · {PREVIEW_WIDTHS[device]}px workspace</div>
            </div>

            {previewError && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100">{previewError}</div>}

            <div className="scorm-panel rounded-2xl border p-3 md:p-5 xl:p-6 overflow-auto min-h-[620px] flex items-center justify-center">
              <GammaCoursePreview analysis={{ ...analysis, slides: analysis.slides }} slide={{ ...slide, __index: selected }} svg={previewSvg} sceneSpec={previewSpec} device={device} loading={previewBusy} />
            </div>
          </main>

          <aside className="scorm-panel rounded-3xl border p-4 space-y-5 xl:sticky xl:top-20 max-h-[82vh] overflow-auto">
            <div className="rounded-2xl border border-[#29423f] bg-[#0c1614] p-3.5">
              <div className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-[#E7E7E4] border border-[#CBC5B8]" /><div><div className="text-xs font-semibold">{template.name}</div><div className="text-[10px] text-slate-500 mt-0.5">Single course template · locked</div></div></div>
            </div>

            {issues.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold"><AlertTriangle size={15} />Layout fit</div>
                <ul className="mt-2 space-y-1.5 text-[11px] text-amber-100/75 list-disc pl-4">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </div>
            )}

            <section>
              <div className="flex items-center gap-2 mb-3"><Type size={14} className="text-[#4FC9BF]" /><div className="text-xs font-semibold">Content</div></div>
              <div className="space-y-3">
                <div>{editorLabel('Screen title')}<input value={slide.title || ''} onChange={(e) => updateSlide({ title: e.target.value })} className="w-full p-2.5 text-sm" /><div className={`mt-1 text-[10px] ${(slide.title || '').length > 58 ? 'text-amber-300' : 'text-slate-500'}`}>{(slide.title || '').length}/52 target · {wordCount(slide.title)} words</div></div>
                <div>{editorLabel('Initial context')}<textarea rows={4} value={slide.introText || ''} onChange={(e) => updateSlide({ introText: e.target.value })} className="w-full p-2.5 text-sm leading-relaxed" /><div className="mt-1 text-[10px] text-slate-500">{wordCount(slide.introText || slide.content)} words</div></div>
                <div>{editorLabel('Progressive reveal')}<textarea rows={4} value={slide.revealText || ''} onChange={(e) => updateSlide({ revealText: e.target.value })} className="w-full p-2.5 text-sm leading-relaxed" /></div>
              </div>
            </section>

            <section className="border-t border-[#29423f] pt-4">
              <div className="flex items-center gap-2 mb-3"><ImageIcon size={14} className="text-[#4FC9BF]" /><div className="text-xs font-semibold">Visual direction</div></div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>{editorLabel('Screen type')}<select value={slide.screenType || 'concept'} onChange={(e) => updateSlide({ screenType: e.target.value })} className="w-full p-2.5 text-xs">{SCREEN_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
                  <div>{editorLabel('Layout')}<select value={slide.layout || 'cards'} onChange={(e) => updateSlide({ layout: e.target.value })} className="w-full p-2.5 text-xs">{COURSE_LAYOUTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
                </div>
                <div>{editorLabel('Smart SVG subject')}<select value={slide.visualMetaphor || 'shield'} onChange={(e) => updateSlide({ visualMetaphor: e.target.value })} className="w-full p-2.5 text-xs">{METAPHORS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
                <div>{editorLabel('Visual title')}<input value={slide.visualTitle || ''} onChange={(e) => updateSlide({ visualTitle: e.target.value })} className="w-full p-2.5 text-xs" /><div className="mt-1 text-[10px] text-slate-500">Keep this to 2–5 words.</div></div>
                <div>{editorLabel('Visual labels')}<textarea rows={5} value={(slide.keyPoints || []).join('\n')} onChange={(e) => updateSlide({ keyPoints: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} className="w-full p-2.5 text-sm" placeholder="One short label per line" /></div>
              </div>
            </section>

            <section className="border-t border-[#29423f] pt-4">
              <div className="text-xs font-semibold mb-3">Interaction</div>
              <div>{editorLabel('Learner prompt')}<textarea rows={3} value={slide.interaction?.prompt || ''} onChange={(e) => updateSlide({ interaction: { ...(slide.interaction || {}), prompt: e.target.value } })} className="w-full p-2.5 text-sm" /></div>
            </section>

            <div className="rounded-xl bg-[#0a1311] border border-[#29423f] p-3 text-[11px] text-slate-500 leading-relaxed">The preview is rendered by the same Smart SVG engine used by SCORM generation. Save & rebuild creates fresh packaged SVG assets and applies the Gamma Editorial learner layout.</div>
          </aside>
        </div>
      )}
    </div>
  );
}
