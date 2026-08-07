import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiUrl } from '../../config';

const DETAIL_LEVELS = [
  { id: 'detailed', label: 'Detailed', hint: '8–12 slides' },
  { id: 'condensed', label: 'Condensed', hint: '5–7 slides' },
  { id: 'summary', label: 'Summary', hint: '3–4 slides' }
];

const TEMPLATES = [
  { id: 1, label: 'Orange Corporate' },
  { id: 4, label: 'Green Growth' },
  { id: 5, label: 'Pink Modern' },
  { id: 3, label: 'Amber Classic' }
];

const DRAFT_KEY = 'quizmoto_scorm_author_draft_v1';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptySlide() {
  return { title: 'New slide', content: '', keyPoints: ['', '', ''], imageQuery: '' };
}

function emptyQuiz() {
  return {
    question: 'New question',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 0
  };
}

export default function ScormAuthor() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [templateId, setTemplateId] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('upload');
  const [error, setError] = useState(null);
  const [resultPkg, setResultPkg] = useState(null);
  const [courseBusy, setCourseBusy] = useState(false);
  const [expandedSlide, setExpandedSlide] = useState(0);
  const [expandedQuiz, setExpandedQuiz] = useState(0);
  const [draftNote, setDraftNote] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d?.analysis && d?.step === 'preview') {
        setAnalysis(d.analysis);
        setTemplateId(d.templateId || 1);
        setDetailLevel(d.detailLevel || 'detailed');
        setStep('preview');
        setDraftNote('Restored local draft');
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (step !== 'preview' || !analysis) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          step: 'preview',
          analysis,
          templateId,
          detailLevel,
          savedAt: Date.now()
        })
      );
      setDraftNote('Draft saved locally');
    } catch (_) {}
  }, [analysis, templateId, detailLevel, step]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {}
    setDraftNote('');
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setAnalysis(null);
    setStep('upload');
  };

  const runAnalyze = async () => {
    if (!file) {
      setError('Choose a PDF or PowerPoint file first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await axios.post(
        apiUrl('/api/scorm/author/analyze'),
        {
          fileBase64,
          mimeType: file.type || 'application/pdf',
          detailLevel
        },
        { headers, timeout: 180000 }
      );
      const a = res.data.analysis || {};
      a.slides = (a.slides || []).map((s) => ({
        title: s.title || '',
        content: s.content || '',
        keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints : [],
        imageQuery: s.imageQuery || ''
      }));
      a.quiz = (a.quiz || []).map((q) => ({
        question: q.question || '',
        options:
          Array.isArray(q.options) && q.options.length >= 2
            ? q.options.slice(0, 6)
            : ['', '', '', ''],
        correctAnswer:
          typeof q.correctAnswer === 'number'
            ? q.correctAnswer
            : Number(q.correctAnswer) || 0
      }));
      setAnalysis(a);
      setStep('preview');
      setExpandedSlide(0);
      setExpandedQuiz(0);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async () => {
    if (!analysis) return;
    if (!String(analysis.title || '').trim()) {
      setError('Title is required');
      return;
    }
    if (!analysis.slides?.length) {
      setError('Add at least one slide');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const clean = {
        ...analysis,
        title: String(analysis.title).trim(),
        summary: String(analysis.summary || '').trim(),
        slides: analysis.slides.map((s) => ({
          title: String(s.title || '').trim() || 'Slide',
          content: String(s.content || '').trim(),
          keyPoints: (s.keyPoints || []).map((k) => String(k || '').trim()).filter(Boolean),
          imageQuery: String(s.imageQuery || '').trim()
        })),
        quiz: (analysis.quiz || []).map((q) => {
          const options = (q.options || []).map((o) => String(o || '').trim());
          let correct = Number(q.correctAnswer) || 0;
          if (correct < 0 || correct >= options.length) correct = 0;
          return {
            question: String(q.question || '').trim() || 'Question',
            options,
            correctAnswer: correct
          };
        })
      };
      const res = await axios.post(
        apiUrl('/api/scorm/author/generate'),
        { analysis: clean, templateId },
        { headers, timeout: 120000 }
      );
      setResultPkg(res.data);
      setStep('done');
      clearDraft();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadResultZip = async () => {
    if (!resultPkg?.packageId) return;
    try {
      const res = await axios.get(apiUrl(`/api/scorm/packages/${resultPkg.packageId}/download`), {
        headers,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(resultPkg.title || 'scorm-package').replace(/[^a-zA-Z0-9._-]+/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Download failed');
    }
  };

  const createCourse = async (andPublish = false) => {
    if (!resultPkg?.packageId) return;
    setCourseBusy(true);
    setError(null);
    try {
      const res = await axios.post(
        apiUrl('/api/scorm/courses'),
        {
          packageId: resultPkg.packageId,
          title: resultPkg.title || analysis?.title || 'AI Course'
        },
        { headers }
      );
      const courseId = res.data.id;
      if (andPublish) {
        await axios.patch(
          apiUrl(`/api/scorm/courses/${courseId}`),
          { status: 'published' },
          { headers }
        );
      }
      navigate(`/scorm/courses/${courseId}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setCourseBusy(false);
    }
  };

  const updateSlide = (idx, field, value) => {
    setAnalysis((prev) => {
      const slides = [...(prev.slides || [])];
      slides[idx] = { ...slides[idx], [field]: value };
      return { ...prev, slides };
    });
  };

  const updateKeyPoint = (slideIdx, kpIdx, value) => {
    setAnalysis((prev) => {
      const slides = [...(prev.slides || [])];
      const kps = [...(slides[slideIdx].keyPoints || [])];
      kps[kpIdx] = value;
      slides[slideIdx] = { ...slides[slideIdx], keyPoints: kps };
      return { ...prev, slides };
    });
  };

  const addKeyPoint = (slideIdx) => {
    setAnalysis((prev) => {
      const slides = [...(prev.slides || [])];
      const kps = [...(slides[slideIdx].keyPoints || []), ''];
      slides[slideIdx] = { ...slides[slideIdx], keyPoints: kps };
      return { ...prev, slides };
    });
  };

  const removeKeyPoint = (slideIdx, kpIdx) => {
    setAnalysis((prev) => {
      const slides = [...(prev.slides || [])];
      const kps = (slides[slideIdx].keyPoints || []).filter((_, i) => i !== kpIdx);
      slides[slideIdx] = { ...slides[slideIdx], keyPoints: kps };
      return { ...prev, slides };
    });
  };

  const addSlide = () => {
    setAnalysis((prev) => {
      const slides = [...(prev.slides || []), emptySlide()];
      setExpandedSlide(slides.length - 1);
      return { ...prev, slides };
    });
  };

  const removeSlide = (idx) => {
    setAnalysis((prev) => {
      const slides = (prev.slides || []).filter((_, i) => i !== idx);
      return { ...prev, slides };
    });
  };

  const updateQuiz = (idx, field, value) => {
    setAnalysis((prev) => {
      const quiz = [...(prev.quiz || [])];
      quiz[idx] = { ...quiz[idx], [field]: value };
      return { ...prev, quiz };
    });
  };

  const updateQuizOption = (qIdx, oIdx, value) => {
    setAnalysis((prev) => {
      const quiz = [...(prev.quiz || [])];
      const options = [...(quiz[qIdx].options || [])];
      options[oIdx] = value;
      quiz[qIdx] = { ...quiz[qIdx], options };
      return { ...prev, quiz };
    });
  };

  const addQuiz = () => {
    setAnalysis((prev) => {
      const quiz = [...(prev.quiz || []), emptyQuiz()];
      setExpandedQuiz(quiz.length - 1);
      return { ...prev, quiz };
    });
  };

  const removeQuiz = (idx) => {
    setAnalysis((prev) => {
      const quiz = (prev.quiz || []).filter((_, i) => i !== idx);
      return { ...prev, quiz };
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative z-10 max-w-4xl mx-auto pb-24">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/scorm" className="text-white/50 hover:text-white text-sm font-bold">
          ← SCORM World
        </Link>
        <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter">Create from policy</h1>
      </div>

      <p className="text-white/50 text-sm mb-4">
        Upload a PDF or PowerPoint. AI builds slides + quiz —{' '}
        <strong className="text-white/80">edit everything</strong>, then package a SCORM 1.2 course into your library.
      </p>

      {draftNote && step === 'preview' && (
        <p className="text-[11px] text-white/40 mb-3">{draftNote}</p>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/15 border border-red-400/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              Document (PDF / PPTX)
            </label>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={onFile}
              className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-quizmoto-blue file:text-white file:font-bold"
            />
            {file && (
              <p className="mt-2 text-xs text-white/50">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              Detail level
            </label>
            <div className="flex flex-wrap gap-2">
              {DETAIL_LEVELS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDetailLevel(d.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border min-h-[44px] ${
                    detailLevel === d.id
                      ? 'bg-quizmoto-yellow text-black border-quizmoto-yellow'
                      : 'bg-white/5 border-white/10 text-white/70'
                  }`}
                >
                  {d.label}
                  <span className="block text-[10px] opacity-70 font-medium">{d.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={busy || !file}
            onClick={runAnalyze}
            className="w-full py-3.5 rounded-xl bg-quizmoto-green text-white font-black text-sm shadow-[0_4px_0_0_#1a5e08] disabled:opacity-50 min-h-[48px]"
          >
            {busy ? 'Analyzing with AI…' : 'Analyze document'}
          </button>
        </div>
      )}

      {step === 'preview' && analysis && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Title</label>
              <input
                value={analysis.title || ''}
                onChange={(e) => setAnalysis({ ...analysis, title: e.target.value })}
                className="w-full mt-1 bg-white/10 border border-white/10 rounded-xl py-2.5 px-3 font-bold text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Summary</label>
              <textarea
                value={analysis.summary || ''}
                onChange={(e) => setAnalysis({ ...analysis, summary: e.target.value })}
                rows={3}
                className="w-full bg-white/10 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white/90 mt-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Theme</label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border min-h-[44px] ${
                    templateId === t.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white/70'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
                slides ({analysis.slides?.length || 0})
              </div>
              <button type="button" onClick={addSlide} className="text-xs font-black px-3 py-1.5 rounded-lg bg-white/10">
                + Add slide
              </button>
            </div>
            {(analysis.slides || []).map((s, i) => (
              <div key={i} className="border border-white/10 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white/5 text-left"
                  onClick={() => setExpandedSlide(expandedSlide === i ? -1 : i)}
                >
                  <span className="font-bold text-sm truncate">
                    {i + 1}. {s.title || 'Untitled'}
                  </span>
                  <span className="text-white/40 text-xs">{expandedSlide === i ? '▼' : '▶'}</span>
                </button>
                {expandedSlide === i && (
                  <div className="p-3 space-y-2 border-t border-white/10">
                    <input
                      value={s.title || ''}
                      onChange={(e) => updateSlide(i, 'title', e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-xl py-2 px-3 font-bold text-sm text-white"
                      placeholder="Slide title"
                    />
                    <textarea
                      value={s.content || ''}
                      onChange={(e) => updateSlide(i, 'content', e.target.value)}
                      rows={4}
                      className="w-full bg-white/10 border border-white/10 rounded-xl py-2 px-3 text-sm text-white/90"
                      placeholder="Slide body"
                    />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Key points</div>
                      {(s.keyPoints || []).map((kp, ki) => (
                        <div key={ki} className="flex gap-2 mb-1.5">
                          <input
                            value={kp}
                            onChange={(e) => updateKeyPoint(i, ki, e.target.value)}
                            className="flex-1 bg-white/10 border border-white/10 rounded-lg py-1.5 px-2 text-sm text-white"
                          />
                          <button type="button" onClick={() => removeKeyPoint(i, ki)} className="text-xs text-red-300/80 px-2">
                            x
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addKeyPoint(i)} className="text-[11px] font-bold text-quizmoto-yellow mt-1">
                        + key point
                      </button>
                    </div>
                    <input
                      value={s.imageQuery || ''}
                      onChange={(e) => updateSlide(i, 'imageQuery', e.target.value)}
                      placeholder="Image query (optional)"
                      className="w-full bg-white/10 border border-white/10 rounded-xl py-2 px-3 text-xs text-white/70"
                    />
                    <button type="button" onClick={() => removeSlide(i)} className="text-xs font-bold text-red-300/90">
                      Remove slide
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Quiz ({analysis.quiz?.length || 0})
              </div>
              <button type="button" onClick={addQuiz} className="text-xs font-black px-3 py-1.5 rounded-lg bg-white/10">
                + Add question
              </button>
            </div>
            {(analysis.quiz || []).map((q, i) => (
              <div key={i} className="border border-white/10 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white/5 text-left"
                  onClick={() => setExpandedQuiz(expandedQuiz === i ? -1 : i)}
                >
                  <span className="font-bold text-sm truncate">
                    Q{i + 1}. {q.question || 'Untitled'}
                  </span>
                  <span className="text-white/40 text-xs">{expandedQuiz === i ? '▼' : '▶'}</span>
                </button>
                {expandedQuiz === i && (
                  <div className="p-3 space-y-2 border-t border-white/10">
                    <textarea
                      value={q.question || ''}
                      onChange={(e) => updateQuiz(i, 'question', e.target.value)}
                      rows={2}
                      className="w-full bg-white/10 border border-white/10 rounded-xl py-2 px-3 text-sm font-bold text-white"
                    />
                    {(q.options || []).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${i}`}
                          checked={Number(q.correctAnswer) === oi}
                          onChange={() => updateQuiz(i, 'correctAnswer', oi)}
                          className="accent-quizmoto-green shrink-0"
                        />
                        <input
                          value={opt}
                          onChange={(e) => updateQuizOption(i, oi, e.target.value)}
                          className={`flex-1 bg-white/10 border rounded-lg py-1.5 px-2 text-sm text-white ${
                            Number(q.correctAnswer) === oi ? 'border-quizmoto-green/60' : 'border-white/10'
                          }`}
                        />
                      </div>
                    ))}
                    <p className="text-[10px] text-white/40">Select the radio for the correct answer.</p>
                    <button type="button" onClick={() => removeQuiz(i)} className="text-xs font-bold text-red-300/90">
                      Remove question
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sticky bottom-2 z-20">
            <button type="button" onClick={() => setStep('upload')} className="px-4 py-3 rounded-xl bg-white/10 font-bold text-sm min-h-[48px]">
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={runGenerate}
              className="flex-1 py-3 rounded-xl bg-quizmoto-blue text-white font-black text-sm disabled:opacity-50 min-h-[48px]"
            >
              {busy ? 'Building SCORM package…' : 'Generate SCORM & save to library'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && resultPkg && (
        <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center space-y-4">
          <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-quizmoto-green/20 text-quizmoto-green">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
              <path
                d="M7 12.5l3.2 3.2L17 8.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-xl font-black">Package ready</h2>
          <p className="text-white/60 text-sm">
            <strong className="text-white">{resultPkg.title}</strong> · status{' '}
            <span className="text-quizmoto-green">{resultPkg.status}</span>
          </p>
          {resultPkg.errorMessage && <p className="text-red-300 text-xs">{resultPkg.errorMessage}</p>}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-2">
            {resultPkg.status === 'ready' && (
              <>
                <button
                  type="button"
                  disabled={courseBusy}
                  onClick={() => createCourse(false)}
                  className="px-4 py-2.5 rounded-xl bg-quizmoto-green font-black text-sm disabled:opacity-50 min-h-[44px]"
                >
                  {courseBusy ? 'Creating…' : 'Create course'}
                </button>
                <button
                  type="button"
                  disabled={courseBusy}
                  onClick={() => createCourse(true)}
                  className="px-4 py-2.5 rounded-xl bg-quizmoto-yellow text-black font-black text-sm disabled:opacity-50 min-h-[44px]"
                >
                  Create & publish
                </button>
              </>
            )}
            <button
              type="button"
              onClick={downloadResultZip}
              className="px-4 py-2.5 rounded-xl bg-quizmoto-blue text-white font-black text-sm min-h-[44px]"
            >
              Download ZIP
            </button>
            <button
              type="button"
              onClick={() => navigate('/scorm/library')}
              className="px-4 py-2.5 rounded-xl bg-white/10 font-bold text-sm min-h-[44px]"
            >
              Open library
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('upload');
                setFile(null);
                setAnalysis(null);
                setResultPkg(null);
                clearDraft();
              }}
              className="px-4 py-2.5 rounded-xl bg-white/10 font-bold text-sm min-h-[44px]"
            >
              Create another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
