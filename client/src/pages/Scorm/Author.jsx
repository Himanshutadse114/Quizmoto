import React, { useState } from 'react';
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

export default function ScormAuthor() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [templateId, setTemplateId] = useState(1);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [error, setError] = useState(null);
  const [resultPkg, setResultPkg] = useState(null);

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
      setAnalysis(res.data.analysis);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async () => {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    try {
      const res = await axios.post(
        apiUrl('/api/scorm/author/generate'),
        { analysis, templateId },
        { headers, timeout: 120000 }
      );
      setResultPkg(res.data);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateSlide = (idx, field, value) => {
    setAnalysis((prev) => {
      const slides = [...(prev.slides || [])];
      slides[idx] = { ...slides[idx], [field]: value };
      return { ...prev, slides };
    });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative z-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/scorm" className="text-white/50 hover:text-white text-sm font-bold">
          ← SCORM World
        </Link>
        <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter">
          Create from policy
        </h1>
      </div>

      <p className="text-white/50 text-sm mb-6">
        Upload a PDF or PowerPoint. AI builds slides + quiz, then packages a SCORM 1.2 course into your library.
        (Uses <code className="text-white/70">policy-to-scorm-engine</code> on the server.)
      </p>

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
                  className={`px-3 py-2 rounded-xl text-xs font-bold border ${
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
            className="w-full py-3.5 rounded-xl bg-quizmoto-green text-white font-black text-sm shadow-[0_4px_0_0_#1a5e08] disabled:opacity-50"
          >
            {busy ? 'Analyzing with AI…' : 'Analyze document'}
          </button>
        </div>
      )}

      {step === 'preview' && analysis && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-5">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Title</label>
            <input
              value={analysis.title || ''}
              onChange={(e) => setAnalysis({ ...analysis, title: e.target.value })}
              className="w-full mt-1 bg-white/10 border border-white/10 rounded-xl py-2.5 px-3 font-bold text-white"
            />
            <p className="mt-3 text-sm text-white/60">{analysis.summary}</p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
              Theme
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                    templateId === t.id
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 border-white/10 text-white/70'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-5 max-h-80 overflow-y-auto space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Slides ({analysis.slides?.length || 0})
            </div>
            {(analysis.slides || []).map((s, i) => (
              <div key={i} className="border-b border-white/5 pb-3">
                <input
                  value={s.title || ''}
                  onChange={(e) => updateSlide(i, 'title', e.target.value)}
                  className="w-full bg-transparent font-bold text-sm text-white border-b border-white/10 py-1 mb-1"
                />
                <p className="text-xs text-white/50 line-clamp-3">{s.content}</p>
              </div>
            ))}
          </div>

          <div className="text-xs text-white/40">
            Quiz questions: {analysis.quiz?.length || 0}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="px-4 py-3 rounded-xl bg-white/10 font-bold text-sm"
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={runGenerate}
              className="flex-1 py-3 rounded-xl bg-quizmoto-blue text-white font-black text-sm disabled:opacity-50"
            >
              {busy ? 'Building SCORM package…' : 'Generate SCORM & save to library'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && resultPkg && (
        <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-black">Package ready</h2>
          <p className="text-white/60 text-sm">
            <strong className="text-white">{resultPkg.title}</strong> · status{' '}
            <span className="text-quizmoto-green">{resultPkg.status}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/scorm/library')}
              className="px-4 py-2.5 rounded-xl bg-quizmoto-green font-black text-sm"
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
              }}
              className="px-4 py-2.5 rounded-xl bg-white/10 font-bold text-sm"
            >
              Create another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
