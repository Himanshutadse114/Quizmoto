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

const INTERACTION_POINT_WORD_LIMIT = 22;
const TOKEN_STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with', 'from', 'your', 'you',
    'is', 'are', 'be', 'as', 'at', 'this', 'that', 'these', 'those', 'it', 'its', 'can', 'may', 'will',
    'all', 'any', 'by', 'use', 'using'
]);

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

function canonicalToken(value) {
    let token = String(value || '').toLowerCase();
    if (token.length > 5 && token.endsWith('ing')) token = token.slice(0, -3);
    else if (token.length > 4 && token.endsWith('ied')) token = `${token.slice(0, -3)}y`;
    else if (token.length > 4 && token.endsWith('ed')) token = token.slice(0, -2);
    else if (token.length > 5 && token.endsWith('ly')) token = token.slice(0, -2);
    else if (token.length > 4 && token.endsWith('es')) token = token.slice(0, -2);
    else if (token.length > 3 && token.endsWith('s')) token = token.slice(0, -1);
    return token;
}

function meaningfulTokens(value) {
    return clean(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !TOKEN_STOP_WORDS.has(token))
        .map(canonicalToken)
        .filter(Boolean);
}

function supportingSentence(point, sentences, usedIndexes) {
    const pointTokens = new Set(meaningfulTokens(point));
    if (!pointTokens.size) return null;

    let best = null;
    let bestScore = 0;

    sentences.forEach((sentence, index) => {
        if (usedIndexes.has(index)) return;
        const sentenceTokens = new Set(meaningfulTokens(sentence));
        let overlap = 0;
        pointTokens.forEach((token) => {
            if (sentenceTokens.has(token)) overlap += 1;
        });
        if (!overlap) return;

        const coverage = overlap / Math.max(1, pointTokens.size);
        const lengthPenalty = Math.abs(words(sentence).length - 14) * 0.02;
        const score = (coverage * 10) + overlap - lengthPenalty;
        if (score > bestScore) {
            bestScore = score;
            best = { index, sentence };
        }
    });

    return best && bestScore >= 3.8 ? best : null;
}

function enrichInteractiveKeyPoints(slide) {
    const source = slide && typeof slide === 'object' ? slide : {};
    const points = Array.isArray(source.keyPoints) ? source.keyPoints.map(clean).filter(Boolean) : [];
    if (!points.length) return points;

    const sentences = sentenceChunks(source.content).map(clean).filter(Boolean);
    if (!sentences.length) return points;

    const usedIndexes = new Set();
    return points.map((point) => {
        const match = supportingSentence(point, sentences, usedIndexes);
        if (!match) return point;
        usedIndexes.add(match.index);
        return trimToWordBudget(match.sentence, INTERACTION_POINT_WORD_LIMIT);
    });
}

// Backwards-compatible export retained for existing callers/tests.
function enrichHighlyInteractiveKeyPoints(slide) {
    return enrichInteractiveKeyPoints(slide);
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

    const enrichPoints = templateId === 'highly-interactive' || templateId === 'scenario-learning';

    return {
        ...source,
        ...(enrichPoints ? { keyPoints: enrichInteractiveKeyPoints(source) } : {}),
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
    INTERACTION_POINT_WORD_LIMIT,
    enrichInteractiveKeyPoints,
    enrichHighlyInteractiveKeyPoints,
    fitSlidePresentationContent,
    fitTemplatePresentationContent,
    layoutBudget,
    trimToWordBudget
};
