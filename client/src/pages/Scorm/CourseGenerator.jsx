import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Palette,
  Sparkles,
  Trash2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startBackgroundCourseGeneration } from '../../services/courseGenerationJobs';
import { apiUrl } from '../../config';
import AuthorVisual from './AuthorVisual';

const EDITORIAL_THEME_ID = 1;
const DEFAULT_COURSE_TEMPLATE_ID = 'professional-classic';
const REMOVED_COURSE_TEMPLATE_IDS = new Set(['visual-product-training']);
const MAX_LOGO_BYTES = 1.5 * 1024 * 1024;

const FALLBACK_TEMPLATE = {
  id: DEFAULT_COURSE_TEMPLATE_ID,
  name: 'Clean & Professional',
  shortName: 'Professional',
  description: 'Balanced corporate learning with clean text, imagery, processes and restrained interactions.',
  experience: 'Balanced corporate',
  defaultInteractionLevel: 'balanced',
  interactionLevels: ['light', 'balanced', 'high']
};

const COURSE_THEMES = [
  {
    id: 'neutral',
    name: 'Neutral',
    description: 'Charcoal, soft paper and restrained teal accents.',
    colours: ['#177E78', '#8EDDD5', '#E7E7E4', '#282824']
  },
  {
    id: 'teal',
    name: 'Teal',
    description: 'Clean teal styling for modern corporate learning.',
    colours: ['#0F8C82', '#63D6CC', '#F2F8F7', '#172321']
  },
  {
    id: 'blue',
    name: 'Blue',
    description: 'Crisp blue styling for product and technology learning.',
    colours: ['#2563EB', '#93C5FD', '#F3F6FB', '#172033']
  },
  {
    id: 'orange',
    name: 'Orange',
    description: 'Warm orange styling for energetic learning experiences.',
    colours: ['#EA6A12', '#FDBA74', '#FBF6F1', '#2D231D']
  },
  {
    id: 'purple',
    name: 'Purple',
    description: 'Polished purple styling for creative learning content.',
    colours: ['#7C3AED', '#C4B5FD', '#F7F4FB', '#271F31']
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Calm green styling for people, policy and safety training.',
    colours: ['#2F855A', '#9AE6B4', '#F3F8F3', '#1E2A22']
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Choose the exact brand colours for this course.',
    colours: ['#0F8C82', '#63D6CC', '#F2F8F7', '#172321']
  }
];

const DEFAULT_CUSTOM_THEME = {
  primary: '#0F8C82',
  accent: '#63D6CC',
  background: '#F2F8F7',
  text: '#172321'
};

function createProgressId() {
  let random = '';
  try {
    random = globalThis.crypto?.randomUUID?.() || '';
  } catch (_) {}
  if (!random) random = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `scorm-course-${random}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
}

function readImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read the selected logo.'));
    reader.readAsDataURL(file);
  });
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
  const [courseTheme, setCourseTheme] = useState('teal');
  const [customTheme, setCustomTheme] = useState(DEFAULT_CUSTOM_THEME);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoName, setLogoName] = useState('');
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
        const templates = (Array.isArray(res.data?.templates) ? res.data.templates : [])
          .filter((item) => item?.id && !REMOVED_COURSE_TEMPLATE_IDS.has(item.id));
        const available = templates.length ? templates : [FALLBACK_TEMPLATE];
        setCourseTemplates(available);
        setTemplateEngineAvailable(Number(res.data?.templateEngineVersion || 0) >= 1);
        setCourseTemplateId((current) => {
          if (available.some((item) => item.id === current)) return current;
          const first = available[0] || FALLBACK_TEMPLATE;
          setInteractionLevel(first.defaultInteractionLevel || 'balanced');
          return first.id;
        });
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

  const selectedTheme = useMemo(
    () => COURSE_THEMES.find((item) => item.id === courseTheme) || COURSE_THEMES[1],
    [courseTheme]
  );

  const previewColours = courseTheme === 'custom'
    ? [customTheme.primary, customTheme.accent, customTheme.background, customTheme.text]
    : selectedTheme.colours;

  const hasSource = Boolean(file || topic.trim() || description.trim());
  const displayTitle = topic.trim() || file?.name || 'New course';

  if (editId) return <AuthorVisual />;

  const selectTemplate = (template) => {
    setCourseTemplateId(template.id);
    setInteractionLevel(template.defaultInteractionLevel || 'balanced');
  };

  const handleLogo = async (event) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    if (!selected) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(selected.type)) {
      setError('Logo must be a PNG, JPG or WebP image.');
      return;
    }
    if (selected.size > MAX_LOGO_BYTES) {
      setError('Logo must be 1.5 MB or smaller.');
      return;
    }

    try {
      const dataUrl = await readImageDataUrl(selected);
      setLogoDataUrl(dataUrl);
      setLogoName(selected.name);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to read the selected logo.');
    }
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
          courseTheme,
          customTheme: courseTheme === 'custom' ? customTheme : null,
          logoDataUrl: logoDataUrl || '',
          ...(templateEngineAvailable ? {
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
            Add a topic, learning goal or source file, then choose the course style and branding. Generation runs in the background while you continue using the platform.
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
                  <div className="text-xs mt-1" style={muted}>Choose how the learner experience should be structured.</div>
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

            <div className="border-t pt-7" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="scorm-micro text-[9px] uppercase font-semibold">Course branding</div>
                  <h3 className="text-[17px] font-semibold mt-1" style={ink}>Add your logo and colour theme</h3>
                  <div className="text-xs mt-1 max-w-2xl" style={muted}>Branding is applied to the generated learner course and retained when the course is rebuilt.</div>
                </div>
                <div className="hidden sm:grid w-10 h-10 rounded-lg border place-items-center shrink-0" style={{ ...softSurface, color: 'var(--scorm-accent)' }}>
                  <Palette size={18} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
                <div className="space-y-5">
                  <div>
                    <div className="text-xs font-semibold" style={ink}>Colour theme</div>
                    <div className="text-[11px] mt-1" style={muted}>Choose a ready-made palette or use your exact brand colours.</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                      {COURSE_THEMES.map((theme) => {
                        const active = courseTheme === theme.id;
                        const colours = theme.id === 'custom'
                          ? [customTheme.primary, customTheme.accent, customTheme.background, customTheme.text]
                          : theme.colours;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setCourseTheme(theme.id)}
                            className="rounded-xl border p-3 text-left transition-all"
                            style={{
                              background: active ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)',
                              borderColor: active ? 'var(--scorm-accent)' : 'var(--scorm-line)'
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold" style={ink}>{theme.name}</span>
                              {active && <CheckCircle2 size={14} style={{ color: 'var(--scorm-accent)' }} />}
                            </div>
                            <div className="flex gap-1 mt-2">
                              {colours.map((colour, index) => (
                                <span key={`${colour}-${index}`} className="h-4 flex-1 rounded border" style={{ background: colour, borderColor: 'rgba(0,0,0,.10)' }} />
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {courseTheme === 'custom' && (
                    <div className="rounded-xl border p-4" style={softSurface}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          ['primary', 'Primary colour'],
                          ['accent', 'Accent colour'],
                          ['background', 'Background colour'],
                          ['text', 'Text colour']
                        ].map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--scorm-line)', background: 'var(--scorm-surface)' }}>
                            <span className="text-[11px] font-semibold" style={ink}>{label}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-[10px] tabular-nums" style={muted}>{customTheme[key].toUpperCase()}</span>
                              <input
                                type="color"
                                value={customTheme[key]}
                                onChange={(e) => setCustomTheme((current) => ({ ...current, [key]: e.target.value.toUpperCase() }))}
                                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                aria-label={label}
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold" style={ink}>Custom logo</div>
                    <div className="text-[11px] mt-1" style={muted}>PNG, JPG or WebP. Maximum 1.5 MB. The logo appears in the course header.</div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <label className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold cursor-pointer">
                        <ImageIcon size={15} />
                        {logoDataUrl ? 'Replace logo' : 'Upload logo'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleLogo} />
                      </label>
                      {logoDataUrl && (
                        <button
                          type="button"
                          onClick={() => { setLogoDataUrl(''); setLogoName(''); }}
                          className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold"
                        >
                          <Trash2 size={14} /> Remove logo
                        </button>
                      )}
                    </div>
                    {logoName && <div className="text-[10px] mt-2 truncate" style={muted}>{logoName}</div>}
                  </div>
                </div>

                <div
                  className="rounded-2xl border overflow-hidden min-h-[190px]"
                  style={{
                    borderColor: 'var(--scorm-line)',
                    background: previewColours[2],
                    color: previewColours[3]
                  }}
                >
                  <div className="h-14 px-4 flex items-center gap-3 border-b" style={{ borderColor: `${previewColours[3]}22` }}>
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt="Logo preview" className="h-8 max-w-[110px] object-contain" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg grid place-items-center text-white text-xs font-bold" style={{ background: previewColours[0] }}>Q</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-[.08em] opacity-60">Brand preview</div>
                      <div className="text-xs font-semibold truncate">{displayTitle}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="h-2 w-20 rounded-full" style={{ background: previewColours[1] }} />
                    <div className="text-lg font-semibold mt-3">Course heading</div>
                    <div className="text-[11px] leading-relaxed mt-2 opacity-70">Your selected colours and logo will be applied throughout the learner course.</div>
                    <button type="button" tabIndex={-1} className="mt-4 rounded-lg px-3 py-2 text-[10px] font-semibold text-white pointer-events-none" style={{ background: previewColours[0] }}>Continue</button>
                  </div>
                </div>
              </div>
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
              <div className="mt-3 pt-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--scorm-line)' }}>
                <span className="text-[10px] uppercase tracking-[.08em] font-semibold" style={muted}>Theme</span>
                <span className="text-xs font-semibold" style={ink}>{selectedTheme?.name || 'Teal'}</span>
              </div>
              <div className="mt-3 text-[10px] leading-relaxed" style={muted}>
                The selected course style and branding are saved with the generated course and retained on rebuild.
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
                ['4', 'Course package', 'The fixed-stage learner package is assembled with your branding and saved.']
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
