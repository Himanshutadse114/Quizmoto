'use strict';

const {
    DEFAULT_COURSE_TEMPLATE_ID,
    currentCourseTemplateVersion,
    getCourseTemplate,
    hasCourseTemplateVersion,
    normalizeCourseTemplateId,
    normalizeInteractionLevel
} = require('./ScormTemplateCatalog');

function templateError(message, code, status, details = {}) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    Object.assign(error, details);
    return error;
}

function unknownTemplateError(value, { stored = false } = {}) {
    return templateError(
        stored
            ? `This saved course references an unavailable course template '${String(value || 'unknown')}'.`
            : `Unknown course template '${String(value || 'unknown')}'.`,
        'SCORM_TEMPLATE_UNKNOWN',
        stored ? 409 : 400,
        { requestedTemplateId: String(value || '') }
    );
}

function unavailableVersionError(templateId, version) {
    return templateError(
        `Course template ${templateId}@${version} is not available on this server. The course will not be silently upgraded to another template version.`,
        'SCORM_TEMPLATE_VERSION_UNAVAILABLE',
        409,
        { requestedTemplateId: templateId, requestedTemplateVersion: version }
    );
}

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
    const templateId = normalizeCourseTemplateId(templateValue, '');
    if (!templateId) throw unknownTemplateError(templateValue);

    const templateVersion = String(
        options.templateVersion || currentCourseTemplateVersion(templateId) || ''
    ).trim();
    if (!hasCourseTemplateVersion(templateId, templateVersion)) {
        throw unavailableVersionError(templateId, templateVersion || 'unknown');
    }

    const template = getCourseTemplate(templateId, templateVersion);
    return Object.freeze({
        templateId: template.id,
        templateVersion: template.version,
        rendererVersion: template.rendererVersion,
        interactionLevel: normalizeInteractionLevel(template.id, options.interactionLevel, template.version),
        locked: true
    });
}

function getTemplateBindingFromAnalysis(analysis) {
    const raw = analysis?.templateBinding;
    if (!raw || typeof raw !== 'object') return null;

    const templateId = normalizeCourseTemplateId(raw.templateId, '');
    if (!templateId) throw unknownTemplateError(raw.templateId, { stored: true });

    const templateVersion = String(
        raw.templateVersion || currentCourseTemplateVersion(templateId) || ''
    ).trim();
    if (!hasCourseTemplateVersion(templateId, templateVersion)) {
        throw unavailableVersionError(templateId, templateVersion || 'unknown');
    }

    const template = getCourseTemplate(templateId, templateVersion);
    return {
        templateId,
        templateVersion: template.version,
        rendererVersion: Number(raw.rendererVersion || template.rendererVersion || 1),
        interactionLevel: normalizeInteractionLevel(templateId, raw.interactionLevel, template.version),
        locked: raw.locked !== false
    };
}

function requestedCourseTemplateId(request = {}) {
    const raw = request.courseTemplateId || request.courseStyleId || '';
    if (!raw) return '';
    const id = normalizeCourseTemplateId(raw, '');
    if (!id) throw unknownTemplateError(raw);
    return id;
}

function resolveNewCourseTemplateBinding(request = {}, analysis = null) {
    const existing = getTemplateBindingFromAnalysis(analysis);
    if (existing) return Object.freeze(existing);
    const requested = requestedCourseTemplateId(request) || DEFAULT_COURSE_TEMPLATE_ID;
    return createTemplateBinding(requested, {
        interactionLevel: request.interactionLevel,
        templateVersion: request.courseTemplateVersion || request.templateVersion || undefined
    });
}

function resolveExistingCourseTemplateBinding({ analysis } = {}) {
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
    const template = getCourseTemplate(binding.templateId, binding.templateVersion);
    if (!template) throw unavailableVersionError(binding.templateId, binding.templateVersion);
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
    resolveNewCourseTemplateBinding,
    unavailableVersionError,
    unknownTemplateError
};
