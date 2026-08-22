import { useEffect, useMemo, useState } from 'react';
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

function PreviewArtwork({ slide }) {
  const points = (slide?.keyPoints || []).filter(Boolean).slice(0, 6);
  const layout = slide?.layout || 'cards';
  const title = slide?.visualTitle || slide?.title || 'Learning visual';

  if (layout === 'comparison') {
    const half = Math.max(1, Math.ceil(points.length / 2));
    return (
      <div className="grid sm:grid-cols-2 gap-3 w-full">
        <div className="rounded-xl border border-[#667765] bg-[#E4E7DF] p-4">
          <div className="text-[10px] uppercase tracking-[.1em] font-bold text-[#405A47] mb-3">Recommended</div>
          {points.slice(0, half).map((point, index) => <div key={index} className="text-sm text-[#282824] mb-2">✓ {point}</div>)}
        </div>
        <div className="rounded-xl border border-[#A56E62] bg-[#EFE1DC] p-4">
          <div className="text-[10px] uppercase tracking-[.1em] font-bold text-[#7A3F33] mb-3">Watch out</div>
          {(points.slice(half).length ? points.slice(half) : ['Pause and verify']).map((point, index) => <div key={index} className="text-sm text-[#282824] mb-2">! {point}</div>)}
        </div>
      </div>
    );
  }

  if (layout === 'process' || layout === 'timeline' || layout === 'cycle') {
    return (
      <div className="w-full space-y-2.5">
        {points.slice(0, 5).map((point, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-3">
            <span className="w-8 h-8 shrink-0 rounded-full border border-white/25 grid place-items-center text-xs font-bold text-white">{index + 1}</span>
            <span className="text-sm text-white/85">{point}</span>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'matrix') {
    return (
      <div className="grid grid-cols-2 gap-3 w-full">
        {['Lower', 'Watch', 'Watch', 'Higher'].map((label, index) => (
          <div key={label + index} className="rounded-xl border border-white/20 bg-white/10 p-4 min-h-[100px]">
            <div className="text-[9px] uppercase tracking-[.12em] text-white/50 font-bold">{label}</div>
            <div className="text-sm text-white/85 mt-2">{points[index] || 'Risk signal'}</div>
          </div>
        ))}
      </div>
    );
  }

  if (layout === 'spotlight') {
    return (
      <div className="min-h-[260px] flex flex-col items-center justify-center text-center px-6">
        <div className="w-24 h-24 rounded-full border border-white/20 bg-white/10 grid place-items-center text-4xl text-white">!</div>
        <div className="text-xl font-bold text-white mt-5">{title}</div>
        <div className="text-sm text-white/60 mt-2 max-w-sm">{points[0] || 'Key learning point'}</div>
      </div>
    );
  }

  if (layout === 'hub') {
    return (
      <div className="w-full flex flex-col items-center gap-4">
        <div className="w-28 h-28 rounded-full border border-white/20 bg-white/10 grid place-items-center text-center p-3">
          <div className="text-sm font-bold text-white leading-tight">{title}</div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {points.slice(0, 4).map((point, index) => <div key={index} className="rounded-xl border border-white/20 bg-white/10 p-3 text-sm text-white/80">{point}</div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {points.slice(0, 6).map((point, index) => (
        <div key={index} className="rounded-xl border border-white/20 bg-white/10 p-3 min-h-[74px] flex gap-2.5 items-start">
          <span className="w-6 h-6 shrink-0 rounded-md bg-white/15 grid place-items-center text-[10px] font-bold text-white">{index + 1}</span>
          <span className="text-sm text-white/80 leading-snug">{point}</span>
        </div>
      ))}
    </div>
  );
}

function SlidePreviewModal({ slide, courseTitle, index, total, onClose }) {
  if (!slide) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm p-3 md:p-8 overflow-auto" role="dialog" aria-modal="true" aria-label="Slide preview">
      <div className="max-w-[1120px] mx-auto">
        <div className="flex items-center justify-between gap-3 mb-3 text-white">
          <div>
            <div className="text-[10px] uppercase tracking-[.12em] text-white/45 font-bold">Read-only slide preview</div>
            <div className="text-sm font-semibold mt-1">Slide {index + 1} of {total}</div>
          </div>
          <button type="button" onClick={onClose} className="scorm-button-secondary w-10 h-10 grid place-items-center" aria-label="Close preview"><X size={17} /></button>
        </div>

        <div className="rounded-[18px] overflow-hidden border border-[#CBC5B8] shadow-2xl bg-[#E7E7E4]">
          <div className="h-12 px-5 flex items-center gap-3 border-b border-[#CBC5B8] bg-[#F4F2EC]">
            <div className="w-7 h-7 rounded-md bg-[#282824] text-white text-[11px] font-black grid place-items-center">Q</div>
            <div className="min-w-0 flex-1 text-[12px] font-semibold text-[#282824] truncate">{courseTitle}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#4A4A45]">Part {index + 1} of {total}</div>
          </div>

          <div className="grid md:grid-cols-[1.08fr_.92fr] min-h-[500px]">
            <section className="p-7 md:p-10 flex flex-col justify-center bg-[#E7E7E4]">
              <div className="text-[10px] uppercase tracking-[.12em] font-bold text-[#6B675F] mb-3">Section {index + 1}</div>
              <h2 className="text-[34px] md:text-[44px] leading-[1.05] tracking-[-.035em] font-black text-[#282824]">{slide.title || 'Untitled slide'}</h2>
              <p className="text-[15px] leading-relaxed text-[#4A4A45] mt-5">{slide.introText || slide.content || ''}</p>
              {!!slide.interaction?.prompt && <div className="mt-6 text-xs font-semibold text-[#6B675F]">{slide.interaction.prompt}</div>}
              {!!slide.revealText && <div className="mt-4 rounded-xl border border-[#CBC5B8] bg-[#F4F2EC] p-4 text-sm leading-relaxed text-[#4A4A45]">{slide.revealText}</div>}
            </section>
            <section className="p-5 md:p-7 flex items-center justify-center bg-[linear-gradient(160deg,#2c2c28,#1a1a18)]">
              <PreviewArtwork slide={slide} />
            </section>
          </div>

          <div className="h-12 px-5 flex items-center justify-between border-t border-[#CBC5B8] bg-[#F4F2EC] text-[11px] font-semibold text-[#4A4A45]">
            <span>Previous</span>
            <span>Preview only</span>
            <span className="px-3 py-1.5 rounded-md bg-[#282824] text-white">Next</span>
          </div>
        </div>
        <p className="text-center text-[11px] text-white/45 mt-3">This preview is for checking one slide. Full learner QA preview is available from the course workspace after generation.</p>
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
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
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
    setBusy(true);
    setError('');
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
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ analysis, detailLevel })); } catch (_) {}
  }, [analysis, detailLevel, editId]);

  const hasSource = Boolean(file || topic.trim() || description.trim());
  const slide = analysis?.slides?.[selected];

  const analyze = async () => {
    if (!hasSource) {
      setError('Add a topic and description or upload a source document.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
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
      setNotice('Learning content is ready. Review and edit the written text, preview individual slides when needed, then generate the course.');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateSlide = (patch) => {
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

  const updateQuiz = (quiz) => setAnalysis((prev) => prev ? { ...prev, quiz } : prev);

  const generate = async () => {
    if (!analysis) return;
    const quizError = validateQuiz(analysis.quiz);
    if (quizError) {
      setError(quizError);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await axios.post(apiUrl('/api/scorm/author/generate'), {
        analysis: cleanForGenerate(analysis),
        templateId: GAMMA_THEME_ID,
        ...(editId ? { replacePackageId: editId } : {})
      }, { headers, timeout: 180000 });

      if (res.data?.errorMessage || (res.data?.status && res.data.status !== 'ready')) {
        setError(res.data?.errorMessage || `Course rebuild finished with status: ${res.data.status}.`);
        return;
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      const id = res.data?.courseId || null;
      setNotice(editId ? 'Course content rebuilt successfully.' : 'Course generated successfully.');
      if (id) navigate(`/scorm/courses/${id}`);
      else navigate('/scorm/courses');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen max-w-[1450px] mx-auto p-4 md:p-7 pb-24 relative z-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">SCORM AI · Content Editor</div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">{editId ? 'Edit course content' : 'Create AI course'}</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">Edit only the learner-facing written content. Visual layout, artwork and course styling remain managed by the course generator.</p>
        </div>
        {analysis && (
          <div className="flex items-center gap-2 flex-wrap">
            {slide && <button type="button" onClick={() => setPreviewOpen(true)} className="scorm-button-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"><Eye size={16} /> Preview slide</button>}
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
                  <div>
                    <div className="text-[10px] uppercase tracking-[.12em] text-slate-500 font-semibold">Course title</div>
                    <input value={analysis.title || ''} onChange={(e) => setAnalysis((prev) => prev ? { ...prev, title: e.target.value } : prev)} className="mt-1 w-full bg-transparent border-0 outline-none text-xl font-semibold text-white p-0" placeholder="Course title" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={selected === 0} onClick={() => setSelected((value) => Math.max(0, value - 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30" aria-label="Previous slide"><ChevronLeft size={16} /></button>
                    <button type="button" disabled={selected >= analysis.slides.length - 1} onClick={() => setSelected((value) => Math.min(analysis.slides.length - 1, value + 1))} className="scorm-button-secondary p-2.5 disabled:opacity-30" aria-label="Next slide"><ChevronRight size={16} /></button>
                    <button type="button" onClick={() => setPreviewOpen(true)} className="scorm-button-secondary inline-flex items-center gap-2 px-3 py-2.5 text-xs font-semibold"><Eye size={14} /> Preview slide</button>
                  </div>
                </div>

                <div className="p-4 md:p-6 space-y-5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Slide title</label>
                    <textarea rows={2} value={slide.title || ''} onChange={(e) => updateSlide({ title: e.target.value })} className="w-full p-3 text-base font-semibold leading-snug" placeholder="Slide title" />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Initial learner text</label>
                    <textarea rows={5} value={slide.introText || ''} onChange={(e) => updateSlide({ introText: e.target.value })} className="w-full p-3 text-sm leading-relaxed" placeholder="Text shown when the slide opens" />
                  </div>

                  {!!(slide.keyPoints || []).length && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Visual labels / key points</label>
                      <div className="grid md:grid-cols-2 gap-2.5">
                        {(slide.keyPoints || []).map((point, index) => (
                          <div key={index} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                            <div className="text-[9px] uppercase tracking-[.1em] text-slate-600 font-bold mb-1.5">Point {index + 1}</div>
                            <textarea rows={2} value={point || ''} onChange={(e) => updatePoint(index, e.target.value)} className="w-full p-2.5 text-sm leading-snug" placeholder={`Point ${index + 1}`} />
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-2">Only the wording can be changed here. The number, layout and position of visual elements remain controlled by the generator.</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Visual title</label>
                    <input value={slide.visualTitle || ''} onChange={(e) => updateSlide({ visualTitle: e.target.value })} className="w-full p-3 text-sm" placeholder="Short text shown inside the visual" />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Interaction instruction</label>
                    <textarea rows={2} value={slide.interaction?.prompt || ''} onChange={(e) => updateSlide({ interaction: { ...(slide.interaction || {}), prompt: e.target.value } })} className="w-full p-3 text-sm leading-relaxed" placeholder="Instruction shown to the learner" />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[.11em] text-slate-500 font-semibold mb-2">Reveal text</label>
                    <textarea rows={4} value={slide.revealText || ''} onChange={(e) => updateSlide({ revealText: e.target.value })} className="w-full p-3 text-sm leading-relaxed" placeholder="Additional text revealed after the learner interacts" />
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

      {previewOpen && slide && (
        <SlidePreviewModal slide={slide} courseTitle={analysis?.title || 'Course'} index={selected} total={analysis?.slides?.length || 1} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}
