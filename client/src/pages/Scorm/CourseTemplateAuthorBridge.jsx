import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Check, Eye, Layers3, Loader2, RotateCcw, X } from 'lucide-react';
import { apiUrl } from '../../config';
import CourseTemplatePreviewModal from './CourseTemplatePreviewModal';
import { normalizeCourseSlide } from './courseExperienceV5';
import {
  COURSE_EXPERIENCE_PROFILES,
  COURSE_INTERACTION_TEMPLATES,
  templateById
} from './courseTemplateCatalog';
import {
  clearCourseSlideTemplateOverride,
  readCourseTemplateOverrides,
  setCourseSlideTemplateOverride
} from '../../services/courseTemplateOverrides';

function profileForTemplate(templateId) {
  return COURSE_EXPERIENCE_PROFILES.find((profile) => profile.templateIds.includes(templateId))?.id || 'auto';
}

function suggestionsForSlide(slide = {}) {
  const layout = String(slide.layout || '').toLowerCase();
  const screenType = String(slide.screenType || '').toLowerCase();
  const type = String(slide.interaction?.type || '').toLowerCase();
  let ids = [];

  if (screenType === 'scenario' || type === 'decision_explore') {
    ids = ['scenario_decision', 'branching_scenario', 'advanced_knowledge_check', 'interactive_tabs'];
  } else if (layout === 'process' || type === 'step_explore') {
    ids = ['process_tabs', 'interactive_timeline', 'accordion', 'sequence_builder'];
  } else if (layout === 'timeline') {
    ids = ['interactive_timeline', 'process_tabs', 'interactive_tabs', 'accordion'];
  } else if (layout === 'comparison' || type === 'compare_reveal') {
    ids = ['accordion', 'interactive_tabs', 'sorting_activity', 'advanced_knowledge_check'];
  } else if (layout === 'hub' || type === 'hotspot_explore') {
    ids = ['interactive_tabs', 'labelled_graphic', 'hotspot_explorer', 'accordion'];
  } else {
    ids = ['flip_cards_classic', 'interactive_tabs', 'accordion', 'advanced_knowledge_check'];
  }

  return ids.map(templateById);
}

export default function CourseTemplateAuthorBridge({ courseId }) {
  const token = localStorage.getItem('token');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [selected, setSelected] = useState(0);
  const [overrides, setOverrides] = useState(() => readCourseTemplateOverrides(courseId));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [previewProfileId, setPreviewProfileId] = useState('auto');

  useEffect(() => {
    setOverrides(readCourseTemplateOverrides(courseId));
  }, [courseId]);

  useEffect(() => {
    if (!open || !courseId || !token || analysis) return;
    setLoading(true);
    setError('');
    axios.get(apiUrl(`/api/scorm/packages/${courseId}/analysis`), {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000
    })
      .then((res) => {
        const raw = res.data?.analysis || {};
        setAnalysis({
          ...raw,
          slides: (Array.isArray(raw.slides) ? raw.slides : []).map(normalizeCourseSlide)
        });
        setSelected(0);
      })
      .catch((err) => setError(err.response?.data?.message || err.message || 'Unable to load course templates.'))
      .finally(() => setLoading(false));
  }, [open, courseId, token, analysis]);

  const slide = analysis?.slides?.[selected] || null;
  const suggestions = useMemo(() => suggestionsForSlide(slide), [slide]);
  const overrideId = overrides[String(selected)] || '';
  const currentTemplate = overrideId ? templateById(overrideId) : templateById(slide?.interaction?.templateId || 'flip_cards_classic');

  const preview = (templateId) => {
    setPreviewTemplateId(templateId);
    setPreviewProfileId(profileForTemplate(templateId));
    setPreviewOpen(true);
  };

  const useTemplate = (templateId) => {
    setCourseSlideTemplateOverride(courseId, selected, templateId);
    setOverrides(readCourseTemplateOverrides(courseId));
    setPreviewOpen(false);
  };

  const resetTemplate = () => {
    clearCourseSlideTemplateOverride(courseId, selected);
    setOverrides(readCourseTemplateOverrides(courseId));
  };

  if (!courseId || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button type="button" className="qmx-v7-studio-fab" onClick={() => setOpen(true)} aria-label="Open interaction template studio">
        <Layers3 size={17} />
        <span>Templates</span>
        {Object.keys(overrides).length > 0 && <b>{Object.keys(overrides).length}</b>}
      </button>

      {open && (
        <div className="qmx-v7-studio-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <aside className="qmx-v7-studio-panel" role="dialog" aria-modal="true" aria-label="Course interaction template studio">
            <header>
              <div>
                <span className="qmx-v7-kicker">Course author · Phase 2</span>
                <h2>Interaction templates</h2>
              </div>
              <button type="button" className="qmx-v7-icon-btn" onClick={() => setOpen(false)} aria-label="Close template studio"><X size={18} /></button>
            </header>

            {loading && <div className="qmx-v7-studio-state"><Loader2 size={18} className="animate-spin" /> Loading course…</div>}
            {error && <div className="qmx-v7-studio-state is-error">{error}</div>}

            {!loading && !error && analysis && (
              <div className="qmx-v7-studio-body">
                <div className="qmx-v7-studio-slides">
                  <span>Slide</span>
                  <select value={selected} onChange={(event) => setSelected(Number(event.target.value))}>
                    {analysis.slides.map((item, index) => (
                      <option key={index} value={index}>{String(index + 1).padStart(2, '0')} · {item.title || 'Untitled'}</option>
                    ))}
                  </select>
                </div>

                {slide && (
                  <>
                    <section className="qmx-v7-studio-current">
                      <div>
                        <span>Current interaction</span>
                        <strong>{currentTemplate.name}</strong>
                        <small>{overrideId ? 'Override will apply on Save & rebuild course.' : 'Generated course setting.'}</small>
                      </div>
                      {overrideId && (
                        <button type="button" onClick={resetTemplate} title="Reset to generated interaction"><RotateCcw size={14} /></button>
                      )}
                    </section>

                    <section className="qmx-v7-studio-source">
                      <span>{slide.screenType || 'learning'} · {slide.layout || 'cards'}</span>
                      <h3>{slide.title}</h3>
                      <p>{slide.introText || slide.content || 'No learner text on this slide.'}</p>
                    </section>

                    <div className="qmx-v7-studio-section-head">
                      <div>
                        <span className="qmx-v7-kicker">Recommended</span>
                        <strong>Preview before applying</strong>
                      </div>
                    </div>

                    <div className="qmx-v7-studio-template-list">
                      {suggestions.map((template) => {
                        const selectedTemplate = currentTemplate.id === template.id;
                        return (
                          <div key={template.id} className={`qmx-v7-studio-template ${selectedTemplate ? 'is-current' : ''}`}>
                            <div>
                              <span>{template.category}</span>
                              <strong>{template.name}</strong>
                              <small>{template.description}</small>
                            </div>
                            <button type="button" onClick={() => preview(template.id)}>
                              {selectedTemplate ? <Check size={14} /> : <Eye size={14} />}
                              {selectedTemplate ? 'Preview' : 'Try'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <details className="qmx-v7-studio-library">
                      <summary>Full interaction library · {COURSE_INTERACTION_TEMPLATES.length}</summary>
                      <div>
                        {COURSE_INTERACTION_TEMPLATES.map((template) => (
                          <button key={template.id} type="button" onClick={() => preview(template.id)}>{template.name}</button>
                        ))}
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}

            <footer>
              <span>Template changes remain non-destructive until you use the editor’s Save & rebuild course action.</span>
            </footer>
          </aside>
        </div>
      )}

      <CourseTemplatePreviewModal
        open={previewOpen}
        profileId={previewProfileId}
        initialTemplateId={previewTemplateId}
        topic={slide?.title || ''}
        description={slide?.introText || slide?.content || ''}
        onClose={() => setPreviewOpen(false)}
        onUseTemplate={useTemplate}
      />
    </>,
    document.body
  );
}
