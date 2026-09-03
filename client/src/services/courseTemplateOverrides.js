import axios from 'axios';

const STORAGE_KEY = 'quizmoto_course_template_overrides_v1';
let installed = false;

function safeRead() {
  if (typeof window === 'undefined') return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

function safeWrite(value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value || {}));
}

export function readCourseTemplateOverrides(courseId) {
  const all = safeRead();
  const item = all[String(courseId || '')];
  return item && typeof item === 'object' ? item : {};
}

export function setCourseSlideTemplateOverride(courseId, slideIndex, templateId) {
  if (!courseId || !Number.isInteger(Number(slideIndex)) || !templateId) return;
  const all = safeRead();
  const id = String(courseId);
  const current = all[id] && typeof all[id] === 'object' ? all[id] : {};
  all[id] = { ...current, [String(Number(slideIndex))]: String(templateId) };
  safeWrite(all);
}

export function clearCourseSlideTemplateOverride(courseId, slideIndex) {
  const all = safeRead();
  const id = String(courseId || '');
  if (!id || !all[id]) return;
  const next = { ...all[id] };
  delete next[String(Number(slideIndex))];
  if (Object.keys(next).length) all[id] = next;
  else delete all[id];
  safeWrite(all);
}

export function clearCourseTemplateOverrides(courseId) {
  const all = safeRead();
  delete all[String(courseId || '')];
  safeWrite(all);
}

function applyOverrides(analysis, overrides) {
  if (!analysis || typeof analysis !== 'object' || !Array.isArray(analysis.slides)) return analysis;
  return {
    ...analysis,
    slides: analysis.slides.map((slide, index) => {
      const templateId = overrides[String(index)];
      if (!templateId) return slide;
      const item = slide && typeof slide === 'object' ? slide : {};
      return {
        ...item,
        interaction: {
          ...(item.interaction && typeof item.interaction === 'object' ? item.interaction : {}),
          templateId
        }
      };
    })
  };
}

function stripInternalAuthoringDirection(value) {
  return String(value || '')
    .replace(/\n{2,}Instructional design direction:[\s\S]*$/i, '')
    .trim();
}

export function installCourseTemplateOverrideInterceptor() {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use((config) => {
    try {
      const url = String(config?.url || '');
      const body = config?.data;
      if (!url.includes('/api/scorm/author/generate') || !body || typeof body !== 'object') return config;

      // Experience-profile metadata is handled by the server-side V7 planner.
      // The temporary frontend direction must never become learner source copy.
      const nextBody = {
        ...body,
        ...(typeof body.description === 'string'
          ? { description: stripInternalAuthoringDirection(body.description) }
          : {})
      };

      if (nextBody.analysis) {
        const courseId = nextBody.replacePackageId || nextBody.packageId || '';
        if (courseId) {
          const overrides = readCourseTemplateOverrides(courseId);
          if (Object.keys(overrides).length) {
            nextBody.analysis = applyOverrides(nextBody.analysis, overrides);
          }
        }
      }

      config.data = nextBody;
    } catch (_) {}
    return config;
  });
}

installCourseTemplateOverrideInterceptor();
