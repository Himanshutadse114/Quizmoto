'use strict';

const { currentCourseTemplateVersion } = require('./ScormTemplateCatalog');
const {
    createTemplateBinding,
    resolveExistingCourseTemplateBinding
} = require('./ScormTemplateBindingService');

function resolveRebuildTemplateBinding({ analysis, pkg } = {}) {
    const existing = resolveExistingCourseTemplateBinding({ analysis, pkg });
    const currentVersion = currentCourseTemplateVersion(existing?.templateId);
    const upgradeProfessional = existing?.templateId === 'professional-classic'
        && Boolean(currentVersion)
        && existing.templateVersion !== currentVersion;

    if (!upgradeProfessional) {
        return {
            binding: existing,
            templateUpgraded: false,
            previousVersion: existing?.templateVersion || null,
            currentVersion: existing?.templateVersion || currentVersion || null
        };
    }

    const binding = createTemplateBinding('professional-classic', {
        templateVersion: currentVersion,
        interactionLevel: 'balanced'
    });

    return {
        binding,
        templateUpgraded: true,
        previousVersion: existing.templateVersion,
        currentVersion: binding.templateVersion
    };
}

module.exports = { resolveRebuildTemplateBinding };
