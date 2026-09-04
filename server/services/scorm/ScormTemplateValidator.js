'use strict';

const { getCourseTemplate } = require('./ScormTemplateCatalog');

function validationError(message, details = []) {
    const error = new Error(message);
    error.code = 'SCORM_TEMPLATE_SCHEMA_INVALID';
    error.status = 422;
    error.details = details;
    return error;
}

function validateTemplateAnalysis(analysis, binding) {
    if (!analysis || typeof analysis !== 'object') {
        throw validationError('Course analysis is required for template validation.');
    }
    if (!binding?.templateId) {
        throw validationError('Course template binding is missing.');
    }

    const template = getCourseTemplate(binding.templateId);
    const allowedLayoutIds = new Set(Object.values(template.layoutIds));
    const allowedInteractions = new Set(template.allowedInteractions);
    const issues = [];

    (Array.isArray(analysis.slides) ? analysis.slides : []).forEach((slide, index) => {
        const layout = String(slide?.layout || '').trim().toLowerCase();
        const layoutId = String(slide?.layoutId || '').trim();
        const interactionType = String(slide?.interaction?.type || '').trim();

        if (!template.allowedLayouts.includes(layout)) {
            issues.push(`Slide ${index + 1}: layout '${layout || 'missing'}' is not allowed by ${template.id}.`);
        }
        if (!layoutId || !allowedLayoutIds.has(layoutId)) {
            issues.push(`Slide ${index + 1}: layout identity '${layoutId || 'missing'}' does not belong to ${template.id}.`);
        }
        if (interactionType && !allowedInteractions.has(interactionType)) {
            issues.push(`Slide ${index + 1}: interaction '${interactionType}' is not allowed by ${template.id}.`);
        }
        if (String(slide?.layoutVersion || '') !== String(binding.templateVersion)) {
            issues.push(`Slide ${index + 1}: layout version does not match the locked template version.`);
        }
        if (String(slide?.interactionVersion || '') !== String(binding.templateVersion)) {
            issues.push(`Slide ${index + 1}: interaction version does not match the locked template version.`);
        }
    });

    if (issues.length) {
        throw validationError(`Course design does not satisfy the locked ${template.name} template contract.`, issues);
    }
    return analysis;
}

module.exports = { validateTemplateAnalysis };
