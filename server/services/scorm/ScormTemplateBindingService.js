'use strict';

const {
    DEFAULT_COURSE_TEMPLATE_ID,
    getCourseTemplate,
    normalizeCourseTemplateId,
    normalizeInteractionLevel
} = require('./ScormTemplateCatalog');

function cloneBinding(binding) {
    return binding ? {
        templateId: binding.templateId,
        templateVersion: binding.templateVersion,
        rendererVersion: Number(binding.rendererVersion || 1),
        interactionLevel: binding.interactionLevel,
        locked: binding.locked !== false
    } : null;
}

function createTemplateBinding(templateValue, options = {}) {
    const templateId = normalizeCourseTemplateId(templateValue);
    const template = getCourseTemplate(templateId);
    return Object.freeze({
        templateId: template.id,
        templateVersion: template.version,
        rendererVersion: template.rendererVersion,
        interactionLevel: normalizeInteractionLevel(template.id, options.interactionLevel),
        locked: true
    });
}

function getTemplateBindingFromAnalysis(analysis) {
    const raw = analysis?.templateBinding;
    if (!raw || typeof raw !== 'object') return null;
    const templateId = normalizeCourseTemplateId(raw.templateId, '');
    if (!templateId) return null;
    const template = getCourseTemplate(templateId);
    return {
        templateId,
        templateVersion: String(raw.templateVersion || template.version),
        rendererVersion: Number(raw.rendererVersion || template.rendererVersion || 1),
        interactionLevel: normalizeInteractionLevel(templateId, raw.interactionLevel),
        locked: raw.locked !== false
    };
}

function requestedCourseTemplateId(request = {}) {
    const raw = request.courseTemplateId || request.courseStyleId || '';
    return raw ? normalizeCourseTemplateId(raw, '') : '';
}

function resolveNewCourseTemplateBinding(request = {}, analysis = null) {
    const existing = getTemplateBindingFromAnalysis(analysis);
    if (existing) return Object.freeze(existing);
    const requested = requestedCourseTemplateId(request) || DEFAULT_COURSE_TEMPLATE_ID;
    return createTemplateBinding(requested, { interactionLevel: request.interactionLevel });
}

function resolveExistingCourseTemplateBinding({ analysis, pkg } = {}) {
    const existing = getTemplateBindingFromAnalysis(analysis);
    if (existing) return Object.freeze(existing);

    // All packages created before the versioned template engine are treated as
    // the original professional course style. We intentionally do not infer a
    // new course style from the legacy numeric theme/template id.
    return createTemplateBinding(DEFAULT_COURSE_TEMPLATE_ID, {
        interactionLevel: analysis?.interactionLevel || 'balanced'
    });
}

function applyTemplateBinding(analysis, binding) {
    const source = analysis && typeof analysis === 'object' ? analysis : {};
    return {
        ...source,
        templateBinding: cloneBinding(binding)
    };
}

function assertRequestedTemplateMatchesBinding(request = {}, binding) {
    const requested = requestedCourseTemplateId(request);
    if (!requested || requested === binding?.templateId) return;
    const error = new Error(
        `This course is locked to ${binding?.templateId || DEFAULT_COURSE_TEMPLATE_ID}. Use an explicit course-style conversion workflow to change templates.`
    );
    error.code = 'SCORM_TEMPLATE_LOCKED';
    error.status = 409;
    error.expectedTemplateId = binding?.templateId || DEFAULT_COURSE_TEMPLATE_ID;
    error.requestedTemplateId = requested;
    throw error;
}

function bindingsEqual(left, right) {
    if (!left || !right) return false;
    return left.templateId === right.templateId
        && left.templateVersion === right.templateVersion
        && Number(left.rendererVersion || 1) === Number(right.rendererVersion || 1)
        && left.interactionLevel === right.interactionLevel;
}

function publicTemplateBinding(binding) {
    if (!binding) return null;
    const template = getCourseTemplate(binding.templateId);
    return {
        ...cloneBinding(binding),
        name: template.name,
        description: template.description,
        stage: { ...template.stage }
    };
}

module.exports = {
    applyTemplateBinding,
    assertRequestedTemplateMatchesBinding,
    bindingsEqual,
    createTemplateBinding,
    getTemplateBindingFromAnalysis,
    publicTemplateBinding,
    requestedCourseTemplateId,
    resolveExistingCourseTemplateBinding,
    resolveNewCourseTemplateBinding
};
