'use strict';

const DEFAULT_COURSE_TEMPLATE_ID = 'professional-classic';
const DEFAULT_TEMPLATE_VERSION = '1.0.0';

const BASE_STAGE = Object.freeze({
    width: 1600,
    height: 900,
    aspectRatio: '16:9',
    allowDocumentScroll: false
});

const COMMON_SCREEN_TYPES = Object.freeze([
    'concept', 'hotspot', 'process', 'scenario', 'comparison', 'reveal', 'timeline', 'takeaway'
]);

const COMMON_INTERACTIONS = Object.freeze([
    'focus_reveal', 'click_reveal', 'hotspot_explore', 'step_explore', 'compare_reveal', 'decision_explore'
]);

function template(definition) {
    return Object.freeze({
        version: DEFAULT_TEMPLATE_VERSION,
        rendererVersion: 1,
        status: 'stable',
        selectable: true,
        legacyThemeId: 1,
        defaultInteractionLevel: 'balanced',
        interactionLevels: Object.freeze(['light', 'balanced', 'high']),
        stage: BASE_STAGE,
        allowedScreenTypes: COMMON_SCREEN_TYPES,
        allowedInteractions: COMMON_INTERACTIONS,
        ...definition,
        layoutIds: Object.freeze({ ...(definition.layoutIds || {}) }),
        allowedLayouts: Object.freeze(Object.keys(definition.layoutIds || {})),
        contentBudgets: Object.freeze({ ...(definition.contentBudgets || {}) })
    });
}

const COURSE_TEMPLATES = Object.freeze({
    'professional-classic': template({
        id: 'professional-classic',
        name: 'Clean & Professional',
        shortName: 'Professional',
        description: 'Balanced corporate learning with clean text, imagery, processes and restrained interactions.',
        experience: 'Balanced corporate',
        layoutIds: {
            spotlight: 'professional-classic.image-text',
            cards: 'professional-classic.cards',
            process: 'professional-classic.process',
            timeline: 'professional-classic.timeline',
            comparison: 'professional-classic.comparison',
            hub: 'professional-classic.topic-hub'
        },
        contentBudgets: {
            maxTitleChars: 78,
            maxBodyWords: 150,
            maxPoints: 4,
            maxInteractionItems: 4
        }
    }),
    'highly-interactive': template({
        id: 'highly-interactive',
        name: 'Highly Interactive',
        shortName: 'Interactive',
        description: 'Exploration-led learning with flip cards, hotspots, reveals, timelines and decisions.',
        experience: 'Explore and discover',
        defaultInteractionLevel: 'high',
        layoutIds: {
            spotlight: 'highly-interactive.focus-reveal',
            cards: 'highly-interactive.flip-cards',
            process: 'highly-interactive.stepper',
            timeline: 'highly-interactive.timeline',
            comparison: 'highly-interactive.compare-reveal',
            hub: 'highly-interactive.hotspot'
        },
        contentBudgets: {
            maxTitleChars: 68,
            maxBodyWords: 115,
            maxPoints: 4,
            maxInteractionItems: 4
        }
    }),
    'scenario-learning': template({
        id: 'scenario-learning',
        name: 'Scenario Learning',
        shortName: 'Scenario',
        description: 'Decision-led learning using workplace situations, consequences, coaching and guided sequences.',
        experience: 'Decide and reflect',
        defaultInteractionLevel: 'high',
        layoutIds: {
            spotlight: 'scenario-learning.scene',
            cards: 'scenario-learning.choices',
            process: 'scenario-learning.guided-process',
            timeline: 'scenario-learning.sequence',
            comparison: 'scenario-learning.consequence-compare',
            hub: 'scenario-learning.clue-explore'
        },
        contentBudgets: {
            maxTitleChars: 68,
            maxBodyWords: 110,
            maxPoints: 4,
            maxInteractionItems: 4
        }
    }),
    'visual-product-training': template({
        id: 'visual-product-training',
        name: 'Visual Product Training',
        shortName: 'Visual',
        description: 'Image-led learning for products, software and procedures with labelled visuals and guided steps.',
        experience: 'See and explore',
        layoutIds: {
            spotlight: 'visual-product-training.image-split',
            cards: 'visual-product-training.labels',
            process: 'visual-product-training.steps',
            timeline: 'visual-product-training.timeline',
            comparison: 'visual-product-training.before-after',
            hub: 'visual-product-training.hotspot'
        },
        contentBudgets: {
            maxTitleChars: 72,
            maxBodyWords: 105,
            maxPoints: 4,
            maxInteractionItems: 5
        }
    })
});

function normalizeCourseTemplateId(value, fallback = DEFAULT_COURSE_TEMPLATE_ID) {
    const id = String(value || '').trim().toLowerCase();
    return COURSE_TEMPLATES[id] ? id : fallback;
}

function getCourseTemplate(value) {
    const id = normalizeCourseTemplateId(value);
    return COURSE_TEMPLATES[id];
}

function listCourseTemplates({ selectableOnly = true } = {}) {
    return Object.values(COURSE_TEMPLATES)
        .filter((item) => !selectableOnly || item.selectable)
        .map((item) => ({
            id: item.id,
            version: item.version,
            rendererVersion: item.rendererVersion,
            name: item.name,
            shortName: item.shortName,
            description: item.description,
            experience: item.experience,
            defaultInteractionLevel: item.defaultInteractionLevel,
            interactionLevels: [...item.interactionLevels],
            stage: { ...item.stage },
            allowedLayouts: [...item.allowedLayouts],
            allowedInteractions: [...item.allowedInteractions],
            contentBudgets: { ...item.contentBudgets }
        }));
}

function normalizeInteractionLevel(templateValue, value) {
    const selectedTemplate = getCourseTemplate(templateValue);
    const requested = String(value || '').trim().toLowerCase();
    return selectedTemplate.interactionLevels.includes(requested)
        ? requested
        : selectedTemplate.defaultInteractionLevel;
}

module.exports = {
    COURSE_TEMPLATES,
    DEFAULT_COURSE_TEMPLATE_ID,
    DEFAULT_TEMPLATE_VERSION,
    getCourseTemplate,
    listCourseTemplates,
    normalizeCourseTemplateId,
    normalizeInteractionLevel
};
