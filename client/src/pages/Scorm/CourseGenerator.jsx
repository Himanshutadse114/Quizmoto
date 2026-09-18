import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowRight, CheckCircle2, FileText, FileUp, Film, Loader2, Presentation, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startBackgroundCourseGeneration } from '../../services/courseGenerationJobs';
import { apiUrl } from '../../config';
import AuthorVisual from './AuthorVisual';
import CourseBrandingPanel, { DEFAULT_BRANDING, PresentationLogoPanel } from './CourseBrandingPanel';

const EDITORIAL_THEME_ID = 1;
const DEFAULT_COURSE_TEMPLATE_ID = 'professional-classic';

const FALLBACK_TEMPLATE = {
  id: DEFAULT_COURSE_TEMPLATE_ID,
  name: 'Clean & Professional',
  shortName: 'Professional',
  description: 'Balanced corporate learning with clean text, imagery, processes and restrained interactions.',
  experience: 'Balanced corporate',
  defaultInteractionLevel: 'balanced',
  interactionLevels: ['light', 'balanced', 'high']
};

function createProgressId() {
  let random = '';
  try {
    random = globalThis.crypto?.randomUUID?.() || '';
  } catch {
    random = '';
  }
  if (!random) random = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `scorm-course-${random}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

const depthOptions = [
  { value: 'concise', label: 'Concise', description: 'A focused course for quick learning.' },
  { value: 'detailed', label: 'Detailed', description: 'Balanced depth for most training needs.' },
  { value: 'comprehensive', label: 'Comprehensive', description: 'Broader coverage for deeper learning.' }
];

const interactionLabels = {
  light: { label: 'Light', copy: 'Mostly direct learning with occasional interaction.' },
  balanced: { label: 'Balanced', copy: 'A mix of direct learning and learner exploration.' },
  high: { label: 'High', copy: 'More reveals, hotspots, decisions and interactive screens.' }
};

function usableTemplates(items) {
  const next = (Array.isArray(items) ? items : []).filter((item) => item?.id !== 'visual-product-training');
  return next.length ? next : [FALLBACK_TEMPLATE];
}

function isPdfFile(file) {
  if (!file) return false;
  return String(file.name || '').toLowerCase().endsWith('.pdf') || String(file.type || '').toLowerCase().includes('pdf');
}

function isVideoFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'].includes(type) || /\.(mp4|webm|ogv|ogg|mov)$/.test(name);
}

function videoMimeType(file) {
  const declared = String(file?.type || '').toLowerCase();
  if (['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'].includes(declared)) return declared;
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.ogg') || name.endsWith('.ogv')) return 'video/ogg';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

function videoDuration(file) {
  return new Promise((resolve) => {
    const element = document.createElement('video');
    const url = URL.createObjectURL(file);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const value = Number(element.duration || 0);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) ? value : 0);
    };
    element.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    element.src = url;
  });
}

function encodeVideoMetadata(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default function CourseGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || '';
  const replaceVideoId = searchParams.get('replaceVideo') || '';
  const token = localStorage.getItem('token');

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [courseMode, setCourseMode] = useState(() => (searchParams.get('mode') === 'video' || searchParams.get('replaceVideo')) ? 'video' : 'generated');
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [courseTemplates, setCourseTemplates] = useState([FALLBACK_TEMPLATE]);
  const [templateEngineAvailable, setTemplateEngineAvailable] = useState(false);
  const [courseTemplateId, setCourseTemplateId] = useState(DEFAULT_COURSE_TEMPLATE_ID);
  const [interactionLevel, setInteractionLevel] = useState('balanced');
  const [branding, setBranding] = useState({ ...DEFAULT_BRANDING });
  const [brandingError, setBrandingError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  useEffect(() => {
    if (!token || !replaceVideoId) return undefined;
    let cancelled = false;
    axios.get(apiUrl(`/api/scorm/video-courses/${encodeURIComponent(replaceVideoId)}`), {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000
    }).then((response) => {
      if (cancelled) return;
      setTopic(response.data?.title || '');
      setDescription(response.data?.description || '');
    }).catch((err) => {
      if (!cancelled) setError(err.response?.data?.message || err.message || 'Unable to load this video course.');
    });
    return () => { cancelled = true; };
  }, [token, replaceVideoId]);

  useEffect(() => {
    if (!token || editId) return undefined;
    let cancelled = false;

    axios.get(apiUrl('/api/scorm/author/templates'), {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    })
      .then((res) => {
        if (cancelled) return;
        const templates = usableTemplates(res.data?.templates);
        setCourseTemplates(templates);
        setTemplateEngineAvailable(Number(res.data?.templateEngineVersion || 0) >= 1);
        if (!templates.some((item) => item.id === courseTemplateId)) {
          const first = templates[0] || FALLBACK_TEMPLATE;
          setCourseTemplateId(first.id);
          setInteractionLevel(first.defaultInteractionLevel || 'balanced');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCourseTemplates([FALLBACK_TEMPLATE]);
          setTemplateEngineAvailable(false);
          setCourseTemplateId(DEFAULT_COURSE_TEMPLATE_ID);
          setInteractionLevel('balanced');
        }
      });

    return () => { cancelled = true; };
  }, [token, editId]);

  const selectedTemplate = useMemo(
    () => courseTemplates.find((item) => item.id === courseTemplateId) || courseTemplates[0] || FALLBACK_TEMPLATE,
    [courseTemplates, courseTemplateId]
  );

  const presentationMode = courseMode === 'presentation';
  const videoMode = courseMode === 'video';
  const generatedMode = courseMode === 'generated';
  const hasSource = presentationMode
    ? Boolean(file && isPdfFile(file))
    : videoMode
      ? Boolean(file && isVideoFile(file))
      : Boolean(file || topic.trim() || description.trim());
  const displayTitle = topic.trim() || String(file?.name || 'New course').replace(/\.[^.]+$/, '');

  if (editId) return <AuthorVisual />;

  const selectTemplate = (template) => {
    setCourseTemplateId(template.id);
    setInteractionLevel(template.defaultInteractionLevel || 'balanced');
  };

  const selectCourseMode = (mode) => {
    setCourseMode(mode);
    setError('');
    setUploadProgress(0);
    if (mode === 'presentation' && file && !isPdfFile(file)) setFile(null);
    if (mode === 'video' && file && !isVideoFile(file)) setFile(null);
  };

  const selectSourceFile = (nextFile) => {
    if (presentationMode && nextFile && !isPdfFile(nextFile)) {
      setFile(null);
      setError('Presentation courses accept PDF files only. Export the PowerPoint or Gamma presentation as PDF, then upload it here.');
      return;
    }
    if (videoMode && nextFile && !isVideoFile(nextFile)) {
      setFile(null);
      setError('Video courses accept MP4, WebM, OGG or MOV files only.');
      return;
    }
    setError('');
    setFile(nextFile || null);
    if (videoMode && nextFile && !topic.trim()) setTopic(String(nextFile.name || '').replace(/\.[^.]+$/, ''));
  };

  const generateCourse = async () => {
    if (!hasSource || busy || !token || brandingError) return;
    setError('');
    setBusy(true);
    setUploadProgress(0);

    try {
      if (videoMode) {
        const durationSeconds = await videoDuration(file);
        const response = await axios({
          method: replaceVideoId ? 'put' : 'post',
          url: apiUrl(replaceVideoId ? `/api/scorm/video-courses/${encodeURIComponent(replaceVideoId)}` : '/api/scorm/video-courses'),
          data: file,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': videoMimeType(file),
            'X-Video-Course-Metadata': encodeVideoMetadata({
              title: displayTitle,
              description: description.trim(),
              durationSeconds,
              fileName: file.name
            })
          },
          timeout: 15 * 60 * 1000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          onUploadProgress: (event) => setUploadProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0)
        });
        navigate(`/scorm/courses/${response.data.courseId}`, { replace: true, state: { courseMessage: replaceVideoId ? 'Video replaced and trackable course rebuilt.' : 'Video course created and ready to preview.' } });
        return;
      }
      const progressId = createProgressId();
      startBackgroundCourseGeneration({
        token,
        title: displayTitle,
        file,
        payload: {
          progressId,
          courseMode: presentationMode ? 'presentation' : 'generated',
          topic: topic.trim(),
          description: presentationMode ? '' : description.trim(),
          fileBase64: '',
          mimeType: file?.type || '',
          detailLevel,
          templateId: EDITORIAL_THEME_ID,
          sourceFileName: file?.name || '',
          branding: {
            logoDataUrl: branding.logoDataUrl || '',
            ...(!presentationMode ? {
              primaryColor: branding.primaryColor,
              accentColor: branding.accentColor
            } : {})
          },
          ...(!presentationMode && templateEngineAvailable ? {
            courseTemplateId,
            interactionLevel
          } : {})
        }
      });

      navigate('/scorm/courses', {
        state: {
          generationStarted: true,
          progressId,
          title: displayTitle
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || (videoMode ? 'Unable to create the video course. Please retry.' : 'Unable to start course generation. Please try again.'));
      setBusy(false);
    }
  };

  const surface = { background: 'var(--scorm-surface)', borderColor: 'var(--scorm-line)' };
  const softSurface = { background: 'var(--scorm-surface-soft)', borderColor: 'var(--scorm-line)' };
  const ink = { color: 'var(--scorm-ink)' };
  const muted = { color: 'var(--scorm-muted)' };

  return (
    <div className="scorm-course-generator p-4 md:p-7 lg:p-9 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7 pb-7 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
        <div className="max-w-3xl">
          <div className="scorm-micro text-[10px] uppercase font-semibold">{replaceVideoId ? 'Video course editor' : 'Course builder'}</div>
          <h1 className="scorm-display text-[42px] md:text-[56px] mt-2" style={ink}>{replaceVideoId ? 'Replace video and rebuild' : 'Create a course'}</h1>
          <p className="text-sm mt-3 leading-relaxed max-w-2xl" style={muted}>
            {presentationMode
              ? 'Upload the presentation PDF, optionally name the course and add your logo. The slides provide everything needed to create the tracked course and end quiz.'
              : videoMode
                ? 'Upload a video and LMSGEN will turn it into a responsive, resumable and downloadable trackable course with genuine watched-coverage tracking.'
                : 'Add a topic, learning goal or source file, choose the learning experience and apply your course branding. Generation runs in the background while you continue using the platform.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/scorm/courses')}
          className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold"
        >
          View courses <ArrowRight size={14} />
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--scorm-danger-soft)', borderColor: 'var(--scorm-danger)', color: 'var(--scorm-danger)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <section className="scorm-course-generator-panel rounded-2xl border overflow-hidden" style={surface}>
          <div className="scorm-course-generator-panel-header px-5 md:px-6 py-5 border-b flex items-center justify-between gap-4" style={{ borderColor: 'var(--scorm-line)' }}>
            <div>
              <div className="scorm-micro text-[9px] uppercase font-semibold">Course source</div>
              <h2 className="text-[18px] font-semibold mt-1" style={ink}>{presentationMode ? 'Upload your finished presentation' : videoMode ? 'Upload your learning video' : 'Tell us what the course should cover'}</h2>
            </div>
            <div className="scorm-course-generator-icon hidden sm:grid w-10 h-10 rounded-lg border place-items-center" style={{ ...softSurface, color: 'var(--scorm-accent)' }}>
              {videoMode ? <Film size={18} /> : <FileText size={18} />}
            </div>
          </div>

          <div className="p-5 md:p-6 space-y-7">
            <div>
              <div className="scorm-micro text-[9px] uppercase font-semibold mb-3">Build method</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  disabled={Boolean(replaceVideoId)}
                  onClick={() => selectCourseMode('generated')}
                  className="text-left rounded-xl border p-4 transition-all min-h-[116px] disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{ background: generatedMode ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)', borderColor: generatedMode ? 'var(--scorm-accent)' : 'var(--scorm-line)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Sparkles size={18} style={{ color: 'var(--scorm-accent)' }} />
                    {generatedMode && <CheckCircle2 size={16} style={{ color: 'var(--scorm-accent)' }} />}
                  </div>
                  <div className="text-sm font-semibold mt-3" style={ink}>Generate a course</div>
                  <div className="text-[11px] leading-relaxed mt-1" style={muted}>AI creates the learning structure, visuals and selected interactions.</div>
                </button>
                <button
                  type="button"
                  disabled={Boolean(replaceVideoId)}
                  onClick={() => selectCourseMode('presentation')}
                  className="text-left rounded-xl border p-4 transition-all min-h-[116px] disabled:opacity-45 disabled:cursor-not-allowed"
                  style={{ background: presentationMode ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)', borderColor: presentationMode ? 'var(--scorm-accent)' : 'var(--scorm-line)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Presentation size={18} style={{ color: 'var(--scorm-accent)' }} />
                    {presentationMode && <CheckCircle2 size={16} style={{ color: 'var(--scorm-accent)' }} />}
                  </div>
                  <div className="text-sm font-semibold mt-3" style={ink}>Track my presentation</div>
                  <div className="text-[11px] leading-relaxed mt-1" style={muted}>Keep the uploaded slides and add tracking plus a Quizmoto-themed quiz.</div>
                </button>
                <button
                  type="button"
                  disabled={Boolean(replaceVideoId)}
                  onClick={() => selectCourseMode('video')}
                  className="text-left rounded-xl border p-4 transition-all min-h-[116px] disabled:cursor-not-allowed"
                  style={{ background: videoMode ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)', borderColor: videoMode ? 'var(--scorm-accent)' : 'var(--scorm-line)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Film size={18} style={{ color: 'var(--scorm-accent)' }} />
                    {videoMode && <CheckCircle2 size={16} style={{ color: 'var(--scorm-accent)' }} />}
                  </div>
                  <div className="text-sm font-semibold mt-3" style={ink}>Create from video</div>
                  <div className="text-[11px] leading-relaxed mt-1" style={muted}>Package one video as a tracked, assignable and downloadable course.</div>
                </button>
              </div>
            </div>

            {presentationMode && (
              <div className="rounded-xl border p-4" style={{ background: 'var(--scorm-accent-soft)', borderColor: 'var(--scorm-accent)' }}>
                <div className="flex items-start gap-3">
                  <Presentation size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--scorm-accent)' }} />
                  <div>
                    <div className="text-xs font-semibold" style={ink}>Exact slide course — no inserted interactions</div>
                    <div className="text-[11px] leading-relaxed mt-1" style={muted}>
                      Upload a PDF exported from PowerPoint, Gamma or another presentation tool. Each PDF page becomes one optimised slide, which preserves fonts, spacing and artwork without font-based generation failures. The tracked player and quiz use the light Quizmoto teal theme.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {videoMode && (
              <div className="rounded-xl border p-4" style={{ background: 'var(--scorm-accent-soft)', borderColor: 'var(--scorm-accent)' }}>
                <div className="flex items-start gap-3">
                  <Film size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--scorm-accent)' }} />
                  <div>
                    <div className="text-xs font-semibold" style={ink}>{replaceVideoId ? 'Replace the source without creating a duplicate course' : 'A complete trackable video course'}</div>
                    <div className="text-[11px] leading-relaxed mt-1" style={muted}>{replaceVideoId ? 'Upload the replacement video and rebuild the same package. The course link, assignments and workspace remain connected.' : 'The course records genuine watched coverage without counting seek jumps, restores the learner’s position, works on mobile and desktop, and can be downloaded as a portable course ZIP.'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <div className="min-w-0">
                <div className="scorm-micro text-[9px] uppercase font-semibold h-4 flex items-center mb-2">{presentationMode || videoMode ? 'Course title' : 'Topic'}</div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={presentationMode ? 'Optional course title' : videoMode ? 'Video course title' : 'e.g. Phishing Awareness'}
                  className="scorm-course-search w-full h-14 px-3 text-sm"
                />
              </div>

              <div className="min-w-0">
                <div className="scorm-micro text-[9px] uppercase font-semibold h-4 flex items-center mb-2">Source file</div>
                <label className="scorm-course-generator-upload h-14 rounded-lg border px-3 flex items-center gap-3 cursor-pointer transition-colors" style={softSurface}>
                  <FileUp size={16} className="shrink-0" style={{ color: 'var(--scorm-accent)' }} />
                  <span className="text-xs truncate flex-1" style={{ color: file ? 'var(--scorm-ink-soft)' : 'var(--scorm-muted)' }}>
                    {file ? file.name : presentationMode ? 'Upload presentation PDF (required)' : videoMode ? (replaceVideoId ? 'Choose the replacement MP4, WebM, OGG or MOV' : 'Upload MP4, WebM, OGG or MOV (required)') : 'Upload source file (optional)'}
                  </span>
                  <span className="scorm-button-secondary h-10 px-3 inline-flex items-center justify-center text-[10px] font-semibold shrink-0">Browse</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept={presentationMode ? '.pdf,application/pdf' : videoMode ? 'video/mp4,video/webm,video/ogg,video/quicktime,.mov,.ogv' : undefined}
                    onChange={(e) => selectSourceFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>

            {!presentationMode && <label className="block">
              <span className="scorm-micro text-[9px] uppercase font-semibold">{videoMode ? 'Course description · optional' : 'Description or learning goals'}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder={videoMode ? 'Add a short description learners will see with this video course.' : 'Describe what learners should understand and be able to do after completing the course.'}
                className="scorm-course-search mt-1.5 w-full px-3 py-3 text-sm resize-y min-h-[145px]"
              />
            </label>}

            {generatedMode && <div>
              <div className="flex items-end justify-between gap-4 mb-3">
                <div>
                  <div className="scorm-micro text-[9px] uppercase font-semibold">Course depth</div>
                  <div className="text-xs mt-1" style={muted}>Choose how much detail the generated course should include.</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {depthOptions.map((option) => {
                  const selected = detailLevel === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDetailLevel(option.value)}
                      className={`scorm-course-generator-depth ${selected ? 'is-selected' : ''} text-left rounded-xl border p-4 transition-all min-h-[104px]`}
                      style={{ background: selected ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)', borderColor: selected ? 'var(--scorm-accent)' : 'var(--scorm-line)' }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold" style={ink}>{option.label}</span>
                        {selected && <CheckCircle2 size={16} style={{ color: 'var(--scorm-accent)' }} />}
                      </div>
                      <div className="text-[11px] leading-relaxed mt-2" style={muted}>{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>}

            {generatedMode && <CourseBrandingPanel
              value={branding}
              onChange={setBranding}
              error={brandingError}
              onError={setBrandingError}
            />}

            {presentationMode && <PresentationLogoPanel
              logoDataUrl={branding.logoDataUrl}
              onChange={(logoDataUrl) => setBranding((current) => ({ ...current, logoDataUrl }))}
              error={brandingError}
              onError={setBrandingError}
            />}

            {generatedMode && <div>
              <div className="flex items-end justify-between gap-4 mb-3">
                <div>
                  <div className="scorm-micro text-[9px] uppercase font-semibold">Course style</div>
                  <div className="text-xs mt-1" style={muted}>The selected template is permanently bound to this course and remains the same when you rebuild it.</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {courseTemplates.map((template) => {
                  const selected = courseTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template)}
                      className="text-left rounded-xl border p-4 transition-all min-h-[132px]"
                      style={{ background: selected ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)', borderColor: selected ? 'var(--scorm-accent)' : 'var(--scorm-line)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[.08em] font-semibold" style={{ color: 'var(--scorm-accent)' }}>{template.experience || 'Course experience'}</div>
                          <div className="text-sm font-semibold mt-1" style={ink}>{template.name}</div>
                        </div>
                        {selected && <CheckCircle2 size={17} className="shrink-0" style={{ color: 'var(--scorm-accent)' }} />}
                      </div>
                      <div className="text-[11px] leading-relaxed mt-2" style={muted}>{template.description}</div>
                    </button>
                  );
                })}
              </div>

              {templateEngineAvailable && (
                <div className="mt-4 rounded-xl border p-4" style={softSurface}>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold" style={ink}>Interaction level</div>
                      <div className="text-[11px] mt-1" style={muted}>{interactionLabels[interactionLevel]?.copy}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(selectedTemplate?.interactionLevels || ['light', 'balanced', 'high']).map((level) => {
                        const active = interactionLevel === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setInteractionLevel(level)}
                            className="px-3 py-2 rounded-lg border text-[11px] font-semibold transition-colors"
                            style={{ background: active ? 'var(--scorm-accent)' : 'var(--scorm-surface)', color: active ? 'var(--scorm-accent-ink, #07110f)' : 'var(--scorm-ink-soft)', borderColor: active ? 'var(--scorm-accent)' : 'var(--scorm-line)' }}
                          >
                            {interactionLabels[level]?.label || level}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>}
          </div>

          <div className="scorm-course-generator-footer px-5 md:px-6 py-5 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ ...softSurface, borderColor: 'var(--scorm-line)' }}>
            <div className="text-[11px] leading-relaxed max-w-xl" style={muted}>
              {presentationMode
                ? 'The course preserves the slide design, adds a Quizmoto teal quiz, and records progress, resume position, answers, score and completion. You can leave this page after generation starts.'
                : videoMode
                  ? 'The video is packaged into a portable trackable course. Its watched coverage, resume position, active time and completion are recorded in the same reports as every other module.'
                  : 'Your selected branding is embedded in the generated course and downloaded package. You can leave this page after generation starts.'}
            </div>
            <button
              type="button"
              onClick={generateCourse}
              disabled={busy || !hasSource || Boolean(brandingError)}
              className="scorm-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : videoMode ? <Film size={17} /> : <Sparkles size={17} />}
              {busy
                ? videoMode
                  ? uploadProgress < 100 ? `Uploading ${uploadProgress}%` : 'Building course…'
                  : 'Starting…'
                : presentationMode
                  ? 'Create tracked course'
                  : videoMode
                    ? replaceVideoId ? 'Replace video and rebuild' : 'Create video course'
                    : 'Generate course'}
            </button>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="scorm-course-generator-panel rounded-2xl border overflow-hidden" style={surface}>
            <div className="scorm-course-generator-panel-header px-5 py-4 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="scorm-micro text-[9px] uppercase font-semibold">Selected experience</div>
              <h3 className="text-[16px] font-semibold mt-1" style={ink}>{presentationMode ? 'Tracked presentation' : videoMode ? 'Tracked video course' : selectedTemplate?.name || FALLBACK_TEMPLATE.name}</h3>
            </div>
            <div className="p-5">
              <div className="text-[11px] leading-relaxed" style={muted}>{presentationMode ? 'Original slide visuals with no generated interactions, followed by an AI knowledge check.' : videoMode ? 'A responsive video player packaged as a portable trackable course, ready for LMSGEN or another compatible learning platform.' : selectedTemplate?.description || FALLBACK_TEMPLATE.description}</div>
              {generatedMode && <><div className="mt-4 pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
                <span className="text-[10px] uppercase tracking-[.08em] font-semibold" style={muted}>Interaction</span>
                <span className="text-xs font-semibold" style={ink}>{interactionLabels[interactionLevel]?.label || 'Balanced'}</span>
              </div>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--scorm-line)' }}>
                <div className="text-[10px] uppercase tracking-[.08em] font-semibold" style={muted}>Brand colours</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-6 h-6 rounded-full border" style={{ background: branding.primaryColor, borderColor: 'var(--scorm-line)' }} />
                  <span className="w-6 h-6 rounded-full border" style={{ background: branding.accentColor, borderColor: 'var(--scorm-line)' }} />
                  <span className="text-[10px]" style={muted}>{branding.logoDataUrl ? 'Custom logo added' : 'No custom logo'}</span>
                </div>
              </div></>}
              {presentationMode && (
                <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--scorm-line)' }}>
                  <div className="flex items-center gap-2 text-[11px]" style={muted}><CheckCircle2 size={14} style={{ color: 'var(--scorm-accent)' }} />{branding.logoDataUrl ? 'Custom learner-rail logo' : 'Default presentation label'}</div>
                  {['Exact slide order', 'Responsive image playback', 'Quizmoto teal end quiz', 'Tracked score and progress'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[11px]" style={muted}><CheckCircle2 size={14} style={{ color: 'var(--scorm-accent)' }} />{item}</div>
                  ))}
                </div>
              )}
              {videoMode && (
                <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--scorm-line)' }}>
                  {['Genuine watched coverage', 'Automatic resume position', 'Mobile and desktop playback', 'Portable course download'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[11px]" style={muted}><CheckCircle2 size={14} style={{ color: 'var(--scorm-accent)' }} />{item}</div>
                  ))}
                </div>
              )}
              <div className="mt-3 text-[10px] leading-relaxed" style={muted}>
                {presentationMode ? 'Presentation artwork stays unchanged while the quiz and course controls consistently use Quizmoto teal.' : videoMode ? 'Seeking ahead does not count as watched time, so completion evidence reflects content the learner actually viewed.' : 'Template identity, version and course branding are saved with the course so rebuilds can retain the same identity.'}
              </div>
            </div>
          </section>

          <section className="scorm-course-generator-panel rounded-2xl border overflow-hidden" style={surface}>
            <div className="scorm-course-generator-panel-header px-5 py-4 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="scorm-micro text-[9px] uppercase font-semibold">What happens next</div>
              <h3 className="text-[16px] font-semibold mt-1" style={ink}>{videoMode ? 'Video course assembly' : 'Background generation'}</h3>
            </div>
            <div className="p-5 space-y-4">
              {(presentationMode ? [
                ['1', 'Slide preservation', 'Every slide is rendered in its original order and visual layout.'],
                ['2', 'Image optimisation', 'Slides receive consistent dimensions and compact file sizes.'],
                ['3', 'Quiz creation', 'The presentation content guides a Quizmoto-themed end quiz.'],
                ['4', 'Tracking package', 'Progress, resume, answers and score are added.']
              ] : videoMode ? [
                ['1', 'Secure upload', 'The source video is streamed directly to protected storage.'],
                ['2', 'Responsive player', 'A professional player is prepared for desktop, tablet and mobile.'],
                ['3', 'Learning tracking', 'Resume position, active viewing and genuine watched coverage are added.'],
                ['4', 'Portable package', 'A downloadable trackable course ZIP is created and added to My Courses.']
              ] : [
                ['1', 'Course content', 'The learning structure and knowledge checks are prepared.'],
                ['2', 'Template layout', 'Content is mapped to the selected course style.'],
                ['3', 'Brand application', 'Your logo and colours are applied across the learner experience.'],
                ['4', 'Course package', 'The branded trackable package is assembled and saved.']
              ]).map(([number, title, copy]) => (
                <div key={number} className="flex gap-3">
                  <div className="scorm-course-generator-step w-7 h-7 rounded-lg border grid place-items-center text-[10px] font-semibold shrink-0" style={{ ...softSurface, color: 'var(--scorm-accent)' }}>{number}</div>
                  <div>
                    <div className="text-xs font-semibold" style={ink}>{title}</div>
                    <div className="text-[11px] leading-relaxed mt-1" style={muted}>{copy}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="scorm-course-generator-note rounded-2xl border p-5" style={softSurface}>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--scorm-accent)' }} />
              <div>
                <div className="text-xs font-semibold" style={ink}>{presentationMode ? 'Presentation identity stays intact' : videoMode ? 'Portable trackable course, not a separate video product' : 'Branding travels with the course'}</div>
                <div className="text-[11px] leading-relaxed mt-1" style={muted}>
                  {presentationMode ? 'The original slide artwork is embedded into the trackable package, while Quizmoto teal is used for the quiz and player controls.' : videoMode ? 'After creation, publish and assign it like any other course or download the ZIP for use in another compatible learning platform.' : 'The logo and colours are written into the course package, so the branding is retained when the package is downloaded and uploaded to another learning platform.'}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
