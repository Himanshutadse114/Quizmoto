'use strict';

const { getCourseTemplate } = require('./ScormTemplateCatalog');

const BODY_WORD_BUDGETS = Object.freeze({
    'highly-interactive': Object.freeze({
        spotlight: 72,
        cards: 52,
        process: 58,
        timeline: 58,
        comparison: 60,
        hub: 50
    }),
    'scenario-learning': Object.freeze({
        spotlight: 76,
        cards: 62,
        process: 62,
        timeline: 60,
        comparison: 62,
        hub: 58
    }),
    'visual-product-training': Object.freeze({
        spotlight: 62,
        cards: 48,
        process: 54,
        timeline: 54,
        comparison: 56,
        hub: 46
    })
});

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function words(value) {
    return clean(value).split(/\s+/).filter(Boolean);
}

function sentenceChunks(value) {
    const source = clean(value);
    if (!source) return [];
    return source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [source];
}

function trimToWordBudget(value, maxWords) {
    const source = clean(value);
    const allWords = words(source);
    if (!source || !Number.isFinite(maxWords) || maxWords <= 0 || allWords.length <= maxWords) return source;

    const selected = [];
    let count = 0;
    for (const rawSentence of sentenceChunks(source)) {
        const sentence = clean(rawSentence);
        if (!sentence) continue;
        const sentenceWords = words(sentence).length;
        if (selected.length && count + sentenceWords > maxWords) break;
        if (!selected.length && sentenceWords > maxWords) break;
        selected.push(sentence);
        count += sentenceWords;
        if (count >= maxWords) break;
    }

    if (selected.length && count >= Math.max(24, Math.floor(maxWords * 0.58))) {
        return clean(selected.join(' '));
    }

    const clipped = allWords.slice(0, maxWords).join(' ').replace(/[,:;\-]+$/, '').trim();
    if (!clipped) return '';
    return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

function layoutBudget(templateId, layout) {
    const budgets = BODY_WORD_BUDGETS[templateId];
    if (!budgets) return null;
    const key = String(layout || 'spotlight').trim().toLowerCase();
    return budgets[key] || budgets.spotlight;
}

function fitSlidePresentationContent(slide, templateId) {
    const source = slide && typeof slide === 'object' ? slide : {};
    const maxWords = layoutBudget(templateId, source.layout);
    if (!maxWords) {
        const next = { ...source };
        delete next.displayContent;
        delete next.displayContentWordLimit;
        return next;
    }

    return {
        ...source,
        displayContent: trimToWordBudget(source.content, maxWords),
        displayContentWordLimit: maxWords
    };
}

function fitTemplatePresentationContent(analysis, binding) {
    const source = analysis && typeof analysis === 'object' ? analysis : {};
    const template = getCourseTemplate(binding?.templateId);

    if (template.id === 'professional-classic') return source;

    return {
        ...source,
        slides: (Array.isArray(source.slides) ? source.slides : [])
            .map((slide) => fitSlidePresentationContent(slide, template.id))
    };
}

module.exports = {
    BODY_WORD_BUDGETS,
    fitSlidePresentationContent,
    fitTemplatePresentationContent,
    layoutBudget,
    trimToWordBudget
};
