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
    if (explicit === 'timeline') return 'timeline';
    if (explicit === 'comparison') return 'comparison';
    if (/versus|\bvs\b|compare|comparison|before.*after|safe .* unsafe|do .* don.?t/.test(text)) return 'comparison';
    if (/timeline|history|sequence|journey|phase/.test(text)) return 'timeline';
    // Decision language must win over incidental words such as "process" in a
    // genuine workplace situation (for example, "follow the visitor process").
    if (/scenario|case study|imagine|suppose|you receive|you notice|you are asked|someone asks|a colleague asks|what would you|what should you|need to decide|choose (?:a|the|your) response|decision/.test(text)) return 'scenario';
    if (explicit === 'process' || /step|process|workflow|lifecycle|how .* works/.test(text)) return 'process';
    if (/warning signs|red flags|indicators|signals|types of|categories|components|features|controls|buttons|areas|parts|functions/.test(text)) return 'hub';
    return explicit || 'spotlight';
}

function interaction(type, prompt) {
    return { type, prompt };
}

function classicFlipCardPlan() {
    return {
        layout: 'cards',
        screenType: 'reveal',
        interaction: interaction('click_reveal', 'Reveal each key point before continuing.')
    };
}

function professionalPlan(slide, level) {
    const type = String(slide?.screenType || 'concept');
    const layout = String(slide?.layout || 'spotlight');
    const purposeful = ['reveal', 'hotspot'].includes(type);

    if (level === 'light') {
        return { layout, screenType: type, interaction: interaction('none', '') };
    }
    if (purposeful) {
        return {
            layout,
            screenType: type,
            interaction: interaction(type === 'hotspot' ? 'hotspot_explore' : 'click_reveal', type === 'hotspot'
                ? 'Explore the key signals when you are ready.'
                : 'Reveal the key points when you are ready.')
        };
    }
    if (level === 'high' && type === 'process') return { layout, screenType: type, interaction: interaction('step_explore', 'Explore the process in order.') };
    if (level === 'high' && type === 'comparison') return { layout, screenType: type, interaction: interaction('compare_reveal', 'Compare the important differences.') };
    if (level === 'high' && type === 'scenario') return { layout, screenType: type, interaction: interaction('decision_explore', 'Consider the situation and choose a response.') };
    return { layout, screenType: type, interaction: interaction('none', '') };
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
    if (semantic === 'timeline') {
        return { layout: 'timeline', screenType: 'timeline', interaction: interaction('step_explore', 'Follow the situation in sequence and reveal the coaching at each stage.') };
    }
    if (semantic === 'process') {
        return { layout: 'process', screenType: 'process', interaction: interaction('step_explore', 'Explore each response step before continuing.') };
    }
    if (semantic === 'comparison') {
        return { layout: 'comparison', screenType: 'comparison', interaction: interaction('compare_reveal', 'Compare the outcomes and identify what changes the safest decision.') };
    }
    if (semantic === 'hub') {
        return { layout: 'hub', screenType: 'hotspot', interaction: interaction('hotspot_explore', 'Notice each clue and reveal why it matters in the situation.') };
    }
    if (semantic === 'scenario') {
        return {
            layout: 'cards',
            screenType: 'scenario',
            interaction: interaction('decision_explore', 'Consider the situation, choose a response and review the coaching feedback.')
        };
    }

    const interactive = level === 'high' || (level === 'balanced' && index % 2 === 1);
    if (interactive && index % 3 === 1) {
        return {
            layout: 'cards',
            screenType: 'reveal',
            interaction: interaction('click_reveal', 'Explore the learner cues before moving to the next decision.')
        };
    }
    if (interactive && index % 3 === 2) {
        return {
            layout: 'hub',
            screenType: 'hotspot',
            interaction: interaction('hotspot_explore', 'Explore the clues and reflect on what you would notice.')
        };
    }
    return {
        layout: 'spotlight',
        screenType: index === 0 ? 'concept' : 'takeaway',
        interaction: interaction('focus_reveal', 'Review the situation and reveal the coach’s note before continuing.')
    };
}

function visualPlan(slide, index, level) {
    const semantic = semanticKind(slide);

    // Visual Product Training v2 deliberately never uses the Professional
    // flip-card interaction. The image or visual board remains the primary
    // learning surface, while text acts as a guide to what the learner sees.
    if (semantic === 'timeline') {
        return {
            layout: 'timeline',
            screenType: 'timeline',
            interaction: interaction('step_explore', 'Move through each visual stage and notice what changes.')
        };
    }
    if (semantic === 'process') {
        return {
            layout: 'process',
            screenType: 'process',
            interaction: interaction('step_explore', 'Follow the guided visual steps in order.')
        };
    }
    if (semantic === 'comparison') {
        return {
            layout: 'comparison',
            screenType: 'comparison',
            interaction: interaction('compare_reveal', 'Compare the visual states and inspect the important differences.')
        };
    }
    if (semantic === 'hub') {
        return {
            layout: 'hub',
            screenType: 'hotspot',
            interaction: interaction('hotspot_explore', 'Select the numbered callouts on the visual to explore each feature.')
        };
    }

    // High visual mode intentionally creates regular labelled-visual screens even
    // when the source material does not explicitly say "features" or "components".
    // This keeps the experience image-led without inventing factual content.
    if (level === 'high' && index % 3 === 1) {
        return {
            layout: 'hub',
            screenType: 'hotspot',
            interaction: interaction('hotspot_explore', 'Explore the visual callouts and connect each one to the lesson.')
        };
    }
    if (level !== 'light' && index % 3 === 2) {
        return {
            layout: 'process',
            screenType: 'process',
            interaction: interaction('step_explore', 'Use the guided visual sequence to work through the key points.')
        };
    }

    return {
        layout: 'spotlight',
        screenType: semantic === 'scenario' ? 'scenario' : 'concept',
        interaction: interaction('focus_reveal', 'Study the main visual, then open the supporting visual notes.')
    };
}

function templatePlan(templateId, slide, index, interactionLevel) {
    if (templateId === 'highly-interactive') return highInteractivePlan(slide, index, interactionLevel);
    if (templateId === 'scenario-learning') return scenarioPlan(slide, index, interactionLevel);
    if (templateId === 'visual-product-training') return visualPlan(slide, index, interactionLevel);
    return null;
}

const SELECT_EXPLORE_FAMILY = new Set(['step_explore', 'hotspot_explore']);

function alternateInteractivePlan(templateId, slide, index, disallowedTypes = []) {
    const points = Array.isArray(slide?.keyPoints) ? slide.keyPoints.filter(Boolean) : [];
    const options = templateId === 'scenario-learning'
        ? [
            { layout: 'spotlight', screenType: 'takeaway', interaction: interaction('focus_reveal', 'Reveal the coach’s note before continuing.') },
            { layout: 'cards', screenType: 'reveal', interaction: interaction('click_reveal', 'Explore the learner cues before continuing.') },
            { layout: 'hub', screenType: 'hotspot', interaction: interaction('hotspot_explore', 'Explore the clues and reflect on what you notice.') }
        ]
        : [
            { layout: 'cards', screenType: 'reveal', interaction: interaction('click_reveal', 'Open each card to reveal the practical learning point.') },
            { layout: 'hub', screenType: 'hotspot', interaction: interaction('hotspot_explore', 'Explore the key points before continuing.') },
            { layout: 'spotlight', screenType: 'concept', interaction: interaction('focus_reveal', 'Review the lesson and reveal the action to remember.') }
        ];
    if (points.length < 2) return null;
    const disallowed = new Set(disallowedTypes.filter(Boolean));
    const eligible = options.filter((item) => !disallowed.has(item.interaction.type));
    return eligible.length ? eligible[(index + 1) % eligible.length] : null;
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
    const template = getCourseTemplate(binding?.templateId, binding?.templateVersion);
    if (!template) throw new Error(`Course template ${binding?.templateId || 'unknown'}@${binding?.templateVersion || 'unknown'} is unavailable.`);
    const base = planExperienceV5(rawAnalysis);

    let previousInteraction = '';
    let selectExploreCount = 0;
    const sourceSlides = Array.isArray(base.slides) ? base.slides : [];
    // Step and hotspot activities share the same select-an-item/reveal-a-panel
    // mechanic. Keep that whole family to roughly thirty percent of an
    // interactive course so semantic labels do not produce repetitive UX.
    const maxSelectExplore = Math.max(2, Math.ceil(sourceSlides.length * 0.3));
    const slides = sourceSlides.map((slide, index) => {
        if (template.id === 'professional-classic') {
            if (template.version === '1.1.0') {
                return applyStableDesignIdentity({ ...slide, ...classicFlipCardPlan() }, template, binding);
            }
            const planned = template.version === '1.2.0'
                ? professionalPlan(slide, binding.interactionLevel)
                : {};
            return applyStableDesignIdentity({ ...slide, ...planned }, template, binding);
        }
        let planned = templatePlan(template.id, slide, index, binding.interactionLevel) || {};
        const currentType = planned?.interaction?.type || '';
        const genuineDecision = template.id === 'scenario-learning' && currentType === 'decision_explore';
        const shouldDiversify = template.id === 'highly-interactive' || template.id === 'scenario-learning';
        const repeatedType = shouldDiversify && !genuineDecision && currentType && currentType === previousInteraction;
        const exceedsSelectExploreLimit = template.id === 'highly-interactive'
            && SELECT_EXPLORE_FAMILY.has(currentType)
            && selectExploreCount >= maxSelectExplore;
        if (repeatedType || exceedsSelectExploreLimit) {
            const disallowed = [
                ...(repeatedType ? [previousInteraction] : []),
                ...(exceedsSelectExploreLimit ? Array.from(SELECT_EXPLORE_FAMILY) : [])
            ];
            const alternative = alternateInteractivePlan(template.id, slide, index, disallowed);
            if (alternative) planned = alternative;
        }
        previousInteraction = planned?.interaction?.type || currentType;
        if (template.id === 'highly-interactive' && SELECT_EXPLORE_FAMILY.has(previousInteraction)) {
            selectExploreCount += 1;
        }
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
