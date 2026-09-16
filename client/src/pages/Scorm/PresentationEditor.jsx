import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, FileUp, Loader2, Presentation, Save, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../config';
import { startBackgroundCourseGeneration } from '../../services/courseGenerationJobs';
import AuthorQuizEditor from './AuthorQuizEditor';
import { PresentationLogoPanel } from './CourseBrandingPanel';

function progressId() {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `presentation-edit-${value}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

function normalizeQuestion(value = {}) {
  const options = Array.isArray(value.options) ? value.options.slice(0, 4).map((item) => String(item || '')) : [];
  while (options.length < 4) options.push('');
  const correct = Number.isInteger(value.correctAnswer) ? value.correctAnswer : Number(value.correctIndex);
  return {
    question: String(value.question || value.questionText || ''),
    options,
    correctAnswer: Number.isInteger(correct) && correct >= 0 && correct < 4 ? correct : 0,
    explanation: String(value.explanation || '')
  };
}

function completeQuiz(questions) {
  return Array.isArray(questions) && questions.length > 0 && questions.every((question) => (
    String(question.question || '').trim()
    && Array.isArray(question.options)
    && question.options.length === 4
    && question.options.every((option) => String(option || '').trim())
    && Number.isInteger(Number(question.correctAnswer))
    && Number(question.correctAnswer) >= 0
    && Number(question.correctAnswer) < 4
    && String(question.explanation || '').trim()
  ));
}

function validPresentationFile(file) {
  return Boolean(file) && (String(file.name || '').toLowerCase().endsWith('.pdf') || String(file.type || '').toLowerCase().includes('pdf'));
}

export default function PresentationEditor() {
  const { packageId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [replacement, setReplacement] = useState(null);
  const [quizTitle, setQuizTitle] = useState('Knowledge Check');
  const [questions, setQuestions] = useState([]);
  const [passScore, setPassScore] = useState(70);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoError, setLogoError] = useState('');
  const [error, setError] = useState('');

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const ready = title.trim() && completeQuiz(questions) && !logoError && !saving;

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return undefined;
    }
    let cancelled = false;
    axios.get(apiUrl(`/api/scorm/packages/${encodeURIComponent(packageId)}/analysis`), { headers })
      .then((response) => {
        if (cancelled) return;
        const analysis = response.data?.analysis || {};
        if (analysis.courseMode !== 'presentation' && response.data?.source !== 'presentation_import') {
          throw new Error('This package is not an editable presentation course.');
        }
        const quiz = analysis.quiz || {};
        setTitle(String(analysis.title || response.data?.title || 'Presentation course'));
        setDescription(String(analysis.description || ''));
        setSourceName(String(analysis.presentation?.sourceFileName || 'Current presentation'));
        setQuizTitle(String(quiz.title || 'Knowledge Check'));
        setQuestions((Array.isArray(quiz.questions) ? quiz.questions : []).map(normalizeQuestion));
        setLogoDataUrl(String(analysis.branding?.logoDataUrl || ''));
        const storedPassScore = Number(analysis.passScore);
        setPassScore(Math.max(0, Math.min(100, Number.isFinite(storedPassScore) ? storedPassScore : 70)));
      })
      .catch((requestError) => setError(requestError.response?.data?.message || requestError.message || 'Unable to load this presentation course.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [packageId, token, headers, navigate]);

  const chooseReplacement = (file) => {
    if (file && !validPresentationFile(file)) {
      setReplacement(null);
      setError('Choose a PDF exported from the presentation.');
      return;
    }
    setError('');
    setReplacement(file || null);
  };

  const rebuild = () => {
    if (!ready) {
      setError('Complete the course title and every quiz field before rebuilding.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = progressId();
      startBackgroundCourseGeneration({
        token,
        title: title.trim(),
        file: replacement,
        payload: {
          progressId: id,
          courseMode: 'presentation',
          replacePackageId: packageId,
          title: title.trim(),
          topic: title.trim(),
          description: description.trim(),
          sourceFileName: replacement?.name || sourceName,
          mimeType: replacement?.type || '',
          passScore: Number(passScore),
          branding: { logoDataUrl },
          quiz: {
            title: quizTitle.trim() || 'Knowledge Check',
            questions
          }
        }
      });
      navigate('/scorm/courses', {
        state: { generationStarted: true, progressId: id, title: title.trim() }
      });
    } catch (saveError) {
      setSaving(false);
      setError(saveError.message || 'Unable to rebuild the presentation course.');
    }
  };

  if (loading) {
    return <div className="min-h-[55vh] grid place-items-center"><div className="text-center"><Loader2 className="animate-spin mx-auto" size={28} /><div className="text-sm mt-3">Loading presentation editor…</div></div></div>;
  }

  return (
    <div className="scorm-editorial scorm-theme-dark p-4 md:p-7 lg:p-9 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <button type="button" onClick={() => navigate(-1)} className="scorm-button-secondary inline-flex items-center gap-2 px-3 py-2 text-[10px] font-semibold"><ArrowLeft size={13} /> Back</button>
          <div className="scorm-micro text-[10px] uppercase font-semibold mt-5">Presentation course editor</div>
          <h1 className="scorm-display text-[38px] md:text-[52px] mt-2">Edit slides and quiz</h1>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>Keep the current slides for quiz-only changes, or upload a replacement PDF exported from the presentation. Rebuilding keeps the same course, invite link and tracking workspace.</p>
        </div>
        <button type="button" onClick={rebuild} disabled={!ready} className="scorm-button-primary min-h-11 px-5 text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"><Save size={15} /> {saving ? 'Starting rebuild…' : 'Save and rebuild'}</button>
      </div>

      {error && <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ color: 'var(--scorm-danger)', borderColor: 'var(--scorm-danger)', background: 'var(--scorm-danger-soft)' }}>{error}</div>}

      <section className="scorm-panel rounded-2xl border overflow-hidden mb-5">
        <div className="scorm-panel-header p-5 md:p-6 border-b flex items-start justify-between gap-4">
          <div><div className="scorm-eyebrow">Course details</div><h2 className="text-xl mt-1">Presentation source</h2></div>
          <Presentation size={20} style={{ color: 'var(--scorm-accent)' }} />
        </div>
        <div className="p-5 md:p-6 grid lg:grid-cols-2 gap-5">
          <label className="block lg:col-span-2"><span className="scorm-micro text-[9px] uppercase font-semibold">Course title</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="scorm-course-search mt-2 w-full px-3 py-3 text-sm" /></label>
          <label className="block"><span className="scorm-micro text-[9px] uppercase font-semibold">Quiz title</span><input value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} className="scorm-course-search mt-2 w-full px-3 py-3 text-sm" /></label>
          <label className="block"><span className="scorm-micro text-[9px] uppercase font-semibold">Pass score</span><input type="number" min="0" max="100" value={passScore} onChange={(event) => setPassScore(event.target.value)} className="scorm-course-search mt-2 w-full px-3 py-3 text-sm" /></label>
          <label className="block lg:col-span-2"><span className="scorm-micro text-[9px] uppercase font-semibold">Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="scorm-course-search mt-2 w-full px-3 py-3 text-sm" /></label>
          <div className="lg:col-span-2 rounded-xl border p-4" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface-soft)' }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0"><div className="scorm-micro text-[9px] uppercase font-semibold">Current deck</div><div className="text-sm font-semibold mt-1 truncate">{sourceName}</div><div className="text-[11px] mt-1" style={{ color: 'var(--scorm-muted)' }}>{replacement ? `Replacement selected: ${replacement.name}` : 'No replacement selected. Existing slide images will be preserved.'}</div></div>
              <label className="scorm-button-secondary cursor-pointer min-h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold shrink-0"><FileUp size={15} /> Replace PDF<input type="file" accept=".pdf,application/pdf" onChange={(event) => chooseReplacement(event.target.files?.[0] || null)} className="sr-only" /></label>
            </div>
          </div>
          <div className="lg:col-span-2 rounded-xl border px-4 py-3 flex items-start gap-3" style={{ borderColor: 'rgba(79,201,191,.3)', background: 'rgba(79,201,191,.07)' }}><ShieldCheck size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--scorm-accent)' }} /><p className="text-xs leading-relaxed" style={{ color: 'var(--scorm-muted)' }}>The player and quiz always use the Quizmoto teal theme. The original slide artwork is preserved inside the presentation area.</p></div>
          <div className="lg:col-span-2">
            <PresentationLogoPanel
              logoDataUrl={logoDataUrl}
              onChange={setLogoDataUrl}
              error={logoError}
              onError={setLogoError}
            />
          </div>
        </div>
      </section>

      <AuthorQuizEditor quiz={questions} onChange={setQuestions} />

      <div className="mt-5 flex justify-end"><button type="button" onClick={rebuild} disabled={!ready} className="scorm-button-primary min-h-11 px-5 text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"><Save size={15} /> Save and rebuild</button></div>
    </div>
  );
}
