'use strict';

const { planExperienceV5 } = require('./ScormExperiencePlanner');
const { getCourseTemplate } = require('./ScormTemplateCatalog');
const { applyTemplateBinding } = require('./ScormTemplateBindingService');
const { fitTemplatePresentationContent } = require('./ScormTemplateContentFitter');

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function slideText(slide) {
    return `${clean(slide?.title)} ${clean(slide?.content)} ${(Array.isArray(slide?.keyPoints) ? slide.keyPoints : []).join(' ')}`.toLowerCase();
}

function semanticKind(slide) {
    const text = slideText(slide);
    const explicit = String(slide?.layout || '').toLowerCase();
    if (explicit === 'timeline' || /timeline|history|sequence|journey|phase/.test(text)) return 'timeline';
    if (explicit === 'process' || /step|process|workflow|lifecycle|how .* works/.test(text)) return 'process';
    if (explicit === 'comparison' || /versus|\bvs\b|compare|comparison|safe .* unsafe|do .* don.?t/.test(text)) return 'comparison';
    if (/scenario|case study|imagine|suppose|you receive|you notice|what would you|decision/.test(text)) return 'scenario';
    if (/warning signs|red flags|indicators|signals|types of|categories|components|features/.test(text)) return 'hub';
    return explicit || 'spotlight';
}

function interaction(type, prompt) {
    return { type, prompt };
}

function highInteractivePlan(slide, index, level) {
    const semantic = semanticKind(slide);
    if (semantic === 'timeline') return { layout: 'timeline', screenType: 'timeline', interaction: interaction('step_explore', 'Explore each stage to understand how the situation develops.') };
    if (semantic === 'process') return { layout: 'process', screenType: 'process', interaction: interaction('step_explore', 'Open each step to follow the process.') };
    if (semantic === 'comparison') return { layout: 'comparison', screenType: 'comparison', interaction: interaction('compare_reveal', 'Compare the choices and reveal the important differences.') };
    if (semantic === 'scenario') return { layout: 'spotlight', screenType: 'scenario', interaction: interaction('decision_explore', 'Consider the situation and identify the safest response.') };
    if (semantic === 'hub') return { layout: 'hub', screenType: 'hotspot', interaction: interaction('hotspot_explore', 'Select each point to explore the key signals.') };

    const interactive = level === 'high' || (level === 'balanced' && index % 2 === 1);
    if (interactive && index % 3 === 1) return { layout: 'cards', screenType: 'reveal', interaction: interaction('click_reveal', 'Open each card to reveal the practical learning point.') };
    if (interactive && index % 3 === 2) return { layout: 'hub', screenType: 'hotspot', interaction: interaction('hotspot_explore', 'Explore the key points before continuing.') };
    return { layout: 'spotlight', screenType: 'concept', interaction: interaction('focus_reveal', 'Review the lesson and the action to remember.') };
}

function scenarioPlan(slide, index, level) {
    const semantic = semanticKind(slide);
    if (semantic === 'timeline') return { layout: 'timeline', screenType: 'timeline', interaction: interaction('step_explore', 'Follow the situation in sequence.') };
    if (semantic === 'process') return { layout: 'process', screenType: 'process', interaction: interaction('step_explore', 'Follow the guided response step by step.') };
    if (semantic === 'comparison') return { layout: 'comparison', screenType: 'comparison', interaction: interaction('compare_reveal', 'Compare the possible outcomes before deciding.') };

    if (index > 0 && (semantic === 'scenario' || level === 'high' || (level === 'balanced' && index % 2 === 1))) {
        return {
            layout: index % 3 === 0 ? 'cards' : 'spotlight',
            screenType: 'scenario',
            interaction: interaction('decision_explore', 'Consider the workplace situation and choose the most appropriate response.')
        };
    }

    return { layout: 'spotlight', screenType: index === 0 ? 'concept' : 'takeaway', interaction: interaction('focus_reveal', 'Review the context before moving to the next decision.') };
}

function visualPlan(slide, index, level) {
    const semantic = semanticKind(slide);
    if (semantic === 'timeline') return { layout: 'timeline', screenType: 'timeline', interaction: interaction('step_explore', 'Follow the visual sequence.') };
    if (semantic === 'process') return { layout: 'process', screenType: 'process', interaction: interaction('step_explore', 'Explore each visual step in order.') };
    if (semantic === 'comparison') return { layout: 'comparison', screenType: 'comparison', interaction: interaction('compare_reveal', 'Compare the two visual states.') };
    if (semantic === 'hub' || (level !== 'light' && index % 3 === 2)) {
        return { layout: 'hub', screenType: 'hotspot', interaction: interaction('hotspot_explore', 'Select the labelled areas to explore the visual.') };
    }
    if (level === 'high' && index % 4 === 3) {
        return { layout: 'cards', screenType: 'reveal', interaction: interaction('click_reveal', 'Open each label to review the supporting detail.') };
    }
    return { layout: 'spotlight', screenType: semantic === 'scenario' ? 'scenario' : 'concept', interaction: interaction('focus_reveal', 'Use the visual and supporting text together.') };
}

function templatePlan(templateId, slide, index, interactionLevel) {
    if (templateId === 'highly-interactive') return highInteractivePlan(slide, index, interactionLevel);
    if (templateId === 'scenario-learning') return scenarioPlan(slide, index, interactionLevel);
    if (templateId === 'visual-product-training') return visualPlan(slide, index, interactionLevel);
    return null;
}

function applyStableDesignIdentity(slide, template, binding) {
    const layout = String(slide.layout || 'spotlight').toLowerCase();
    const layoutId = template.layoutIds[layout] || template.layoutIds.spotlight;
    return {
        ...slide,
        layout,
        layoutId,
        layoutVersion: binding.templateVersion,
        interactionId: `${template.id}.${slide?.interaction?.type || 'focus_reveal'}`,
        interactionVersion: binding.templateVersion,
        keyPoints: (Array.isArray(slide.keyPoints) ? slide.keyPoints : []).slice(0, template.contentBudgets.maxPoints)
    };
}

function planExperienceForTemplate(rawAnalysis, binding) {
    const template = getCourseTemplate(binding?.templateId);
    const base = planExperienceV5(rawAnalysis);

    const slides = (Array.isArray(base.slides) ? base.slides : []).map((slide, index) => {
        if (template.id === 'professional-classic') {
            return applyStableDesignIdentity(slide, template, binding);
        }
        const planned = templatePlan(template.id, slide, index, binding.interactionLevel) || {};
        return applyStableDesignIdentity({ ...slide, ...planned }, template, binding);
    });

    const plannedAnalysis = applyTemplateBinding({
        ...base,
        experienceVersion: 5,
        templateEngineVersion: 1,
        templatePlanner: `${template.id}@${binding.templateVersion}`,
        slides
    }, binding);

    return fitTemplatePresentationContent(plannedAnalysis, binding);
}

module.exports = {
    planExperienceForTemplate,
    semanticKind
};
