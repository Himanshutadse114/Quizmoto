import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Eye, FileText, FileUp, Loader2, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startBackgroundCourseGeneration } from '../../services/courseGenerationJobs';
import AuthorVisual from './AuthorVisual';
import CourseTemplateAuthorBridge from './CourseTemplateAuthorBridge';
import CourseTemplatePreviewModal from './CourseTemplatePreviewModal';
import {
  COURSE_EXPERIENCE_PROFILES,
  profileById,
  templateById,
  templatesForProfile
} from './courseTemplateCatalog';

const EDITORIAL_THEME_ID = 1;

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

export default function CourseGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || '';
  const token = localStorage.getItem('token');

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [detailLevel, setDetailLevel] = useState('detailed');
  const [experienceProfile, setExperienceProfile] = useState('auto');
  const [preferredTemplateId, setPreferredTemplateId] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  const hasSource = Boolean(file || topic.trim() || description.trim());
  const displayTitle = topic.trim() || file?.name || 'New course';
  const selectedProfile = useMemo(() => profileById(experienceProfile), [experienceProfile]);
  const profileTemplates = useMemo(() => templatesForProfile(experienceProfile), [experienceProfile]);
  const preferredTemplate = preferredTemplateId ? templateById(preferredTemplateId) : null;

  if (editId) {
    return (
      <>
        <AuthorVisual />
        <CourseTemplateAuthorBridge courseId={editId} />
      </>
    );
  }

  const chooseProfile = (profileId) => {
    setExperienceProfile(profileId);
    setPreferredTemplateId('');
    setPreviewTemplateId('');
  };

  const openTemplatePreview = (templateId = '') => {
    setPreviewTemplateId(templateId || preferredTemplateId || profileTemplates[0]?.id || '');
    setPreviewOpen(true);
  };

  const usePreviewedTemplate = (templateId) => {
    setPreferredTemplateId(templateId);
    setPreviewTemplateId(templateId);
    setPreviewOpen(false);
  };

  const generateCourse = () => {
    if (!hasSource || busy || !token) return;
    setError('');
    setBusy(true);

    try {
      const progressId = createProgressId();
      const direction = [
        selectedProfile.aiInstruction,
        preferredTemplate ? `Prefer the ${preferredTemplate.name} interaction when it fits the learning objective.` : '',
        'Do not repeat this authoring instruction in learner-visible content.'
      ].filter(Boolean).join(' ');
      const generationDescription = [
        description.trim(),
        `Instructional design direction: ${direction}`
      ].filter(Boolean).join('\n\n');

      startBackgroundCourseGeneration({
        token,
        title: displayTitle,
        file,
        payload: {
          progressId,
          topic: topic.trim(),
          description: generationDescription,
          fileBase64: '',
          mimeType: file?.type || '',
          detailLevel,
          templateId: EDITORIAL_THEME_ID,
          experienceProfile,
          preferredTemplateId: preferredTemplateId || '',
          interactionTemplateHints: selectedProfile.templateIds
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
            Add a topic, learning goal or source file. AI can choose a varied interaction mix or follow the course experience you select.
          </p>
        </div>
        <button type="button" onClick={() => navigate('/scorm/courses')} className="scorm-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold">
          View courses <ArrowRight size={14} />
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ background: 'var(--scorm-surface-soft)', borderColor: 'var(--scorm-line-strong)', color: 'var(--scorm-ink)' }}>
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

          <div className="p-5 md:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <div className="min-w-0">
                <div className="scorm-micro text-[9px] uppercase font-semibold h-4 flex items-center mb-2">Topic</div>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Phishing Awareness" className="scorm-course-search w-full h-14 px-3 text-sm" />
              </div>

              <div className="min-w-0">
                <div className="scorm-micro text-[9px] uppercase font-semibold h-4 flex items-center mb-2">Source file</div>
                <label className="scorm-course-generator-upload h-14 rounded-lg border px-3 flex items-center gap-3 cursor-pointer transition-colors" style={softSurface}>
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
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe what learners should understand and be able to do after completing the course." className="scorm-course-search mt-1.5 w-full px-3 py-3 text-sm resize-y min-h-[145px]" />
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
                    <button key={option.value} type="button" onClick={() => setDetailLevel(option.value)} className={`scorm-course-generator-depth ${selected ? 'is-selected' : ''} text-left rounded-xl border p-4 transition-all min-h-[104px]`} style={{ background: selected ? 'var(--scorm-accent-soft)' : 'var(--scorm-surface-soft)', borderColor: selected ? 'var(--scorm-accent)' : 'var(--scorm-line)' }}>
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
              <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                <div>
                  <div className="scorm-micro text-[9px] uppercase font-semibold">Course experience</div>
                  <div className="text-xs mt-1" style={muted}>Choose the interaction direction or keep AI on Auto.</div>
                </div>
                <button type="button" onClick={() => openTemplatePreview()} className="scorm-button-secondary inline-flex items-center gap-2 px-3 py-2 text-[10px] font-semibold">
                  <Eye size={14} /> Preview templates
                </button>
              </div>

              <div className="qmx-v7-profile-grid">
                {COURSE_EXPERIENCE_PROFILES.map((profile) => {
                  const selected = experienceProfile === profile.id;
                  return (
                    <button key={profile.id} type="button" onClick={() => chooseProfile(profile.id)} className={`qmx-v7-profile-card ${selected ? 'is-selected' : ''}`}>
                      <div className="qmx-v7-profile-top">
                        <strong>{profile.name}</strong>
                        <span className="qmx-v7-profile-check">{selected && <Check size={13} />}</span>
                      </div>
                      <p>{profile.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="qmx-v7-profile-actions">
                <span className="qmx-v7-profile-summary">{selectedProfile.shortName} · {profileTemplates.length} recommended interactions</span>
                {profileTemplates.slice(0, 3).map((template) => (
                  <span key={template.id} className="qmx-v7-template-pill"><button type="button" onClick={() => openTemplatePreview(template.id)}>{template.name}</button></span>
                ))}
                {preferredTemplate && <span className="qmx-v7-template-pill">Preferred: {preferredTemplate.name}</span>}
              </div>
            </div>
          </div>

          <div className="scorm-course-generator-footer px-5 md:px-6 py-5 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ ...softSurface, borderColor: 'var(--scorm-line)' }}>
            <div className="text-[11px] leading-relaxed max-w-xl" style={muted}>AI will use the selected experience as a design direction. You can still edit the generated course later.</div>
            <button type="button" onClick={generateCourse} disabled={busy || !hasSource} className="scorm-button-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {busy ? 'Starting…' : 'Generate course'}
            </button>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="scorm-course-generator-panel rounded-2xl border overflow-hidden" style={surface}>
            <div className="scorm-course-generator-panel-header px-5 py-4 border-b" style={{ borderColor: 'var(--scorm-line)' }}>
              <div className="scorm-micro text-[9px] uppercase font-semibold">Generation flow</div>
              <h3 className="text-[16px] font-semibold mt-1" style={ink}>AI instructional design</h3>
            </div>
            <div className="p-5 space-y-4">
              {[
                ['1', 'Structure', 'AI turns the source into learning objectives and a course flow.'],
                ['2', 'Interactions', 'Layouts and interactions are matched to each learning objective.'],
                ['3', 'Package', 'Visuals, checks and tracking are assembled into the learner course.']
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
                <div className="text-xs font-semibold" style={ink}>Preview before committing</div>
                <div className="text-[11px] leading-relaxed mt-1" style={muted}>Open any recommended interaction, try it on desktop, tablet or mobile and only then mark it as preferred.</div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <CourseTemplatePreviewModal open={previewOpen} profileId={experienceProfile} initialTemplateId={previewTemplateId} topic={topic} description={description} onClose={() => setPreviewOpen(false)} onUseTemplate={usePreviewedTemplate} />
    </div>
  );
}
