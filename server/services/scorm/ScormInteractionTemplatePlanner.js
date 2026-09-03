const RUNTIME_READY = new Set([
    'flip_cards_classic',
    'interactive_tabs',
    'accordion',
    'process_tabs',
    'interactive_timeline',
    'scenario_decision'
]);

const PROFILE_POOLS = {
    auto: ['interactive_tabs', 'accordion', 'process_tabs', 'interactive_timeline', 'scenario_decision', 'flip_cards_classic'],
    classic: ['flip_cards_classic'],
    interactive: ['interactive_tabs', 'accordion', 'process_tabs', 'interactive_timeline', 'scenario_decision'],
    scenario: ['scenario_decision', 'interactive_timeline', 'accordion', 'interactive_tabs'],
    visual: ['interactive_tabs', 'accordion', 'interactive_timeline', 'process_tabs'],
    assessment: ['scenario_decision', 'accordion', 'interactive_tabs', 'process_tabs']
};

function clean(value) {
    return String(value || '').trim().toLowerCase();
}

function unique(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function candidatesForSlide(slide = {}) {
    const layout = clean(slide.layout);
    const screenType = clean(slide.screenType);
    const interactionType = clean(slide.interaction?.type);

    if (screenType === 'scenario' || interactionType === 'decision_explore') {
        return ['scenario_decision', 'accordion', 'interactive_tabs'];
    }
    if (layout === 'timeline') {
        return ['interactive_timeline', 'process_tabs', 'accordion'];
    }
    if (layout === 'process' || interactionType === 'step_explore') {
        return ['process_tabs', 'interactive_timeline', 'accordion'];
    }
    if (layout === 'comparison' || interactionType === 'compare_reveal') {
        return ['accordion', 'interactive_tabs', 'scenario_decision'];
    }
    if (layout === 'hub' || screenType === 'hotspot' || interactionType === 'hotspot_explore') {
        return ['interactive_tabs', 'accordion', 'flip_cards_classic'];
    }
    if (layout === 'cards' || screenType === 'reveal' || interactionType === 'click_reveal') {
        return ['flip_cards_classic', 'interactive_tabs', 'accordion'];
    }
    return ['accordion', 'interactive_tabs', 'flip_cards_classic'];
}

function normaliseProfile(value) {
    const key = clean(value);
    return PROFILE_POOLS[key] ? key : '';
}

function usableHints(value) {
    return unique(value).map(clean).filter((id) => RUNTIME_READY.has(id));
}

function chooseTemplate(slide, index, options = {}, previousTemplate = '') {
    const profile = normaliseProfile(options.experienceProfile);
    if (!profile) return '';
    if (profile === 'classic') return 'flip_cards_classic';

    const preferred = clean(options.preferredTemplateId);
    const hints = usableHints(options.interactionTemplateHints);
    const profilePool = PROFILE_POOLS[profile] || PROFILE_POOLS.auto;

    // Hints are ranking signals, never a hard restriction. Some author profiles
    // intentionally list templates whose dedicated runtime is still being rolled
    // out; filtering the whole profile to only the surviving hints previously
    // collapsed Highly Interactive down to two choices and then allowed Classic
    // flip cards back in as a universal fallback.
    const hinted = hints.filter((id) => profilePool.includes(id));
    const allowed = unique([...hinted, ...profilePool]).filter((id) => RUNTIME_READY.has(id));
    const preferredReady = preferred && RUNTIME_READY.has(preferred) ? preferred : '';
    const semantic = candidatesForSlide(slide).filter((id) => allowed.includes(id));

    const ranked = unique([
        ...(preferredReady ? [preferredReady] : []),
        ...semantic,
        ...hinted,
        ...allowed
    ]).filter((id) => RUNTIME_READY.has(id) && (allowed.includes(id) || id === preferredReady));

    const semanticPreferred = ranked.filter((id) => semantic.includes(id));
    const pool = semanticPreferred.length ? semanticPreferred : ranked;
    if (!pool.length) {
        return profilePool.find((id) => RUNTIME_READY.has(id)) || (profile === 'auto' ? 'flip_cards_classic' : 'interactive_tabs');
    }

    // Avoid a repetitive Storyline-template feel by rotating away from the
    // previous interaction whenever a semantically suitable alternative exists.
    const nonRepeating = pool.find((id) => id !== previousTemplate);
    if (nonRepeating) return nonRepeating;
    return pool[index % pool.length] || pool[0];
}

function applyInteractionTemplates(rawAnalysis, options = {}) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};
    const profile = normaliseProfile(options.experienceProfile);

    // Existing callers and previously generated courses remain untouched.
    // V7 only activates when the new authoring UI explicitly sends a profile.
    if (!profile) return analysis;

    let previousTemplate = '';
    const slides = (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide, index) => {
        const item = slide && typeof slide === 'object' ? slide : {};
        const existingTemplate = clean(item.interaction?.templateId);
        const selected = existingTemplate && RUNTIME_READY.has(existingTemplate)
            ? existingTemplate
            : chooseTemplate(item, index, options, previousTemplate);
        previousTemplate = selected || previousTemplate;
        return {
            ...item,
            interaction: {
                ...(item.interaction && typeof item.interaction === 'object' ? item.interaction : {}),
                ...(selected ? { templateId: selected } : {})
            }
        };
    });

    return {
        ...analysis,
        experienceProfile: profile,
        interactionEngineVersion: 7,
        slides
    };
}

module.exports = {
    RUNTIME_READY,
    PROFILE_POOLS,
    candidatesForSlide,
    chooseTemplate,
    applyInteractionTemplates,
    normaliseProfile
};
