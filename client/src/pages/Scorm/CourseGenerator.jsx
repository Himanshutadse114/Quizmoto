import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowRight, CheckCircle2, FileText, FileUp, Loader2, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startBackgroundCourseGeneration } from '../../services/courseGenerationJobs';
import { apiUrl } from '../../config';
import AuthorVisual from './AuthorVisual';

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
  } catch (_) {}
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

export default function CourseGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || '';
  const token = localStorage.getItem('token');

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [courseTemplates, setCourseTemplates] = useState([FALLBACK_TEMPLATE]);
  const [templateEngineAvailable, setTemplateEngineAvailable] = useState(false);
  const [courseTemplateId, setCourseTemplateId] = useState(DEFAULT_COURSE_TEMPLATE_ID);
  const [interactionLevel, setInteractionLevel] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  useEffect(() => {
    if (!token || editId) return undefined;
    let cancelled = false;

    axios.get(apiUrl('/api/scorm/author/templates'), {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    })
      .then((res) => {
        if (cancelled) return;
        const templates = Array.isArray(res.data?.templates) ? res.data.templates : [];
        if (!templates.length) return;
        setCourseTemplates(templates);
        setTemplateEngineAvailable(Number(res.data?.templateEngineVersion || 0) >= 1);
        if (!templates.some((item) => item.id === courseTemplateId)) {
          const first = templates[0];
          setCourseTemplateId(first.id);
          setInteractionLevel(first.defaultInteractionLevel || 'balanced');
        }
      })
      .catch(() => {
        // During a rolling deployment an older API can briefly serve the newer
        // frontend. In that compatibility window expose only the existing course
        // style and omit versioned-template fields from the generation request.
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

  const hasSource = Boolean(file || topic.trim() || description.trim());
  const displayTitle = topic.trim() || file?.name || 'New course';

  if (editId) return <AuthorVisual />;

  const selectTemplate = (template) => {
    setCourseTemplateId(template.id);
    setInteractionLevel(template.defaultInteractionLevel || 'balanced');
  };

  const generateCourse = () => {
    if (!hasSource || busy || !token) return;
    setError('');
    setBusy(true);

    try {
      const progressId = createProgressId();
      startBackgroundCourseGeneration({
        token,
        title: displayTitle,
        file,
        payload: {
          progressId,
          topic: topic.trim(),
          description: description.trim(),
          fileBase64: '',
          mimeType: file?.type || '',
          detailLevel,
          templateId: EDITORIAL_THEME_ID,
          ...(templateEngineAvailable ? {
            courseTemplateId,
            interactionLevel
          } : {})
        }
      });

      // Navigation is intentionally immediate. Source-file reading and the API
      // request continue from the background-generation service after this
      // component unmounts.
      navigate('/scorm/courses', {
        state: {
          generationStarted: true,
          progressId,
          title: displayTitle
        }
      });
    } catch (err) {
      setError(err.message || 'Unable to start course generation. Please try again.');
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
          <div className="scorm-micro text-[10px] uppercase font-semibold">Course builder</div>
          <h1 className="scorm-display text-[42px] md:text-[56px] mt-2" style={ink}>Create a course</h1>
          <p className="text-sm mt-3 leading-relaxed max-w-2xl" style={muted}>
            Add a topic, learning goal or source file, then choose how the learning experience should feel. Generation runs in the background while you continue using the platform.
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
              <h2 className="text-[18px] font-semibold mt-1" style={ink}>Tell us what the course should cover</h2>
            </div>
            <div className="scorm-course-generator-icon hidden sm:grid w-10 h-10 rounded-lg border place-items-center" style={{ ...softSurface, color: 'var(--scorm-accent)' }}>
              <FileText size={18} />
            </div>
          </div>

          <div className="p-5 md:p-6 space-y-7">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <div className="min-w-0">
                <div className="scorm-micro text-[9px] uppercase font-semibold h-4 flex items-center mb-2">Topic</div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Phishing Awareness"
                  className="scorm-course-search w-full h-14 px-3 text-sm"
                />
              </div>

              <div className="min-w-0">
                <div className="scorm-micro text-[9px] uppercase font-semibold h-4 flex items-center mb-2">Source file</div>
                <label
                  className="scorm-course-generator-upload h-14 rounded-lg border px-3 flex items-center gap-3 cursor-pointer transition-colors"
                  style={softSurface}
                >
                  <FileUp size={16} className="shrink-0" style={{ color: 'var(--scorm-accent)' }} />
                  <span className="text-xs truncate flex-1" style={{ color: file ? 'var(--scorm-ink-soft)' : 'var(--scorm-muted)' }}>
                    {file ? file.name : 'Upload source file (optional)'}
                  </span>
                  <span className="scorm-button-secondary h-10 px-3 inline-flex items-center justify-center text-[10px] font-semibold shrink-0">Browse</span>
                  <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>

            <label className="block">
              <span className="scorm-micro text-[9px] uppercase font-semibold">Description or learning goals</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe what learners should understand and be able to do after completing the course."
                className="scorm-course-search mt-1.5 w-full px-3 py-3 text-sm resize-y min-h-[145px]"
              />
            </label>

            <div>
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
                      style={{
                        background: selected ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)',
                        borderColor: selected ? 'var(--scorm-accent)' : 'var(--scorm-line)'
                      }}
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
            </div>

            <div>
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
                      style={{
                        background: selected ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)',
                        borderColor: selected ? 'var(--scorm-accent)' : 'var(--scorm-line)'
                      }}
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
                            style={{
                              background: active ? 'var(--scorm-accent)' : 'var(--scorm-surface)',
                              color: active ? 'var(--scorm-accent-ink, #07110f)' : 'var(--scorm-ink-soft)',
                              borderColor: active ? 'var(--scorm-accent)' : 'var(--scorm-line)'
                            }}
                          >
                            {interactionLabels[level]?.label || level}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="scorm-course-generator-footer px-5 md:px-6 py-5 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ ...softSurface, borderColor: 'var(--scorm-line)' }}>
            <div className="text-[11px] leading-relaxed max-w-xl" style={muted}>
              You can leave this page after generation starts. Progress remains visible from Courses and you will be notified when the course is ready.
            </div>
            <button
              type="button"
              onClick={generateCourse}
              disabled={busy || !hasSource}
              className="scorm-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {busy ? 'Starting…' : 'Generate course'}
            </button>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="scorm-course-generator-panel rounded-2xl border overflow-hidden" style={surface}>
            <div className="scorm-course-generator-panel-header px-5 py-4 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="scorm-micro text-[9px] uppercase font-semibold">Selected experience</div>
              <h3 className="text-[16px] font-semibold mt-1" style={ink}>{selectedTemplate?.name || FALLBACK_TEMPLATE.name}</h3>
            </div>
            <div className="p-5">
              <div className="text-[11px] leading-relaxed" style={muted}>{selectedTemplate?.description || FALLBACK_TEMPLATE.description}</div>
              <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
                <span className="text-[10px] uppercase tracking-[.08em] font-semibold" style={muted}>Interaction</span>
                <span className="text-xs font-semibold" style={ink}>{interactionLabels[interactionLevel]?.label || 'Balanced'}</span>
              </div>
              <div className="mt-3 text-[10px] leading-relaxed" style={muted}>
                Template identity and version are saved with the course. Editing or rebuilding the course will not switch it to another template.
              </div>
            </div>
          </section>

          <section className="scorm-course-generator-panel rounded-2xl border overflow-hidden" style={surface}>
            <div className="scorm-course-generator-panel-header px-5 py-4 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="scorm-micro text-[9px] uppercase font-semibold">What happens next</div>
              <h3 className="text-[16px] font-semibold mt-1" style={ink}>Background generation</h3>
            </div>
            <div className="p-5 space-y-4">
              {[
                ['1', 'Course content', 'The learning structure and knowledge checks are prepared.'],
                ['2', 'Template layout', 'Content is mapped only to layouts allowed by the selected course style.'],
                ['3', 'Course visuals', 'Supporting visuals are created for the selected layouts.'],
                ['4', 'Course package', 'The fixed-stage learner package is assembled and saved.']
              ].map(([number, title, copy]) => (
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
                <div className="text-xs font-semibold" style={ink}>No need to wait on this page</div>
                <div className="text-[11px] leading-relaxed mt-1" style={muted}>
                  Once generation begins, continue working anywhere in the platform. Your course will appear in Courses when it is ready.
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
