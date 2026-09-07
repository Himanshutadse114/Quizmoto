'use strict';

const { currentCourseTemplateVersion } = require('./ScormTemplateCatalog');
const {
    createTemplateBinding,
    resolveExistingCourseTemplateBinding
} = require('./ScormTemplateBindingService');

function upgradeInteractionLevel(templateId, existing) {
    if (templateId === 'professional-classic') return 'balanced';
    if (templateId === 'visual-product-training') {
        return existing?.interactionLevel === 'balanced' ? 'balanced' : 'high';
    }
    return existing?.interactionLevel || 'balanced';
}

function resolveRebuildTemplateBinding({ analysis, pkg } = {}) {
    const existing = resolveExistingCourseTemplateBinding({ analysis, pkg });
    const currentVersion = currentCourseTemplateVersion(existing?.templateId);
    const upgradeableTemplate = existing?.templateId === 'professional-classic'
        || existing?.templateId === 'visual-product-training';
    const shouldUpgrade = upgradeableTemplate
        && Boolean(currentVersion)
        && existing.templateVersion !== currentVersion;

    if (!shouldUpgrade) {
        return {
            binding: existing,
            templateUpgraded: false,
            upgradeKind: null,
            previousVersion: existing?.templateVersion || null,
            currentVersion: existing?.templateVersion || currentVersion || null
        };
    }

    const binding = createTemplateBinding(existing.templateId, {
        templateVersion: currentVersion,
        interactionLevel: upgradeInteractionLevel(existing.templateId, existing)
    });

    return {
        binding,
        templateUpgraded: true,
        upgradeKind: existing.templateId === 'visual-product-training' ? 'visual-product' : 'professional',
        previousVersion: existing.templateVersion,
        currentVersion: binding.templateVersion
    };
}

module.exports = { resolveRebuildTemplateBinding };
