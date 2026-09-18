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

const INTERACTION_POINT_WORD_LIMIT = 28;
const INTERACTION_LABEL_WORD_LIMIT = 8;
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

function trimToTeachingBudget(value, maxWords) {
    const source = clean(value);
    const allWords = words(source);
    if (!source || !Number.isFinite(maxWords) || maxWords <= 0 || allWords.length <= maxWords) return source;

    const sentences = sentenceChunks(source).map(clean).filter(Boolean);
    if (sentences.length < 2) return trimToWordBudget(source, maxWords);

    const conclusion = sentences[sentences.length - 1];
    const conclusionWords = words(conclusion).length;
    const canReserveConclusion = conclusionWords > 0 && conclusionWords <= Math.min(28, Math.floor(maxWords * 0.48));
    const openingBudget = canReserveConclusion ? maxWords - conclusionWords : maxWords;
    const selected = [];
    let selectedWords = 0;

    for (const sentence of sentences.slice(0, -1)) {
        const count = words(sentence).length;
        if (!count || selectedWords + count > openingBudget) break;
        selected.push(sentence);
        selectedWords += count;
    }

    if (canReserveConclusion && selected.length && selectedWords + conclusionWords <= maxWords) {
        selected.push(conclusion);
        selectedWords += conclusionWords;
    }

    if (selected.length >= 2 && selectedWords >= Math.max(24, Math.floor(maxWords * 0.55))) {
        return clean(selected.join(' '));
    }
    return trimToWordBudget(source, maxWords);
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

function conciseInteractionLabel(value, index = 0) {
    const source = clean(value).replace(/^[0-9]+[.)\s-]*/, '').replace(/[.!?]+$/, '');
    if (!source) return `Point ${String(index + 1).padStart(2, '0')}`;
    const allWords = words(source);
    if (allWords.length <= INTERACTION_LABEL_WORD_LIMIT) return source;

    const meaningful = source
        .split(/\s+/)
        .map((word) => word.replace(/[^A-Za-z0-9'-]/g, ''))
        .filter((word) => word && !TOKEN_STOP_WORDS.has(word.toLowerCase()))
        .slice(0, 6);
    const selected = meaningful.length >= 3 ? meaningful : allWords.slice(0, 6);
    const label = selected.join(' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function interactionDetailIsDistinct(label, detail) {
    const cleanLabel = clean(label).toLowerCase();
    const cleanDetail = clean(detail).toLowerCase();
    if (!cleanLabel || !cleanDetail || cleanLabel === cleanDetail) return false;
    const labelTokens = new Set(meaningfulTokens(label));
    const detailTokens = new Set(meaningfulTokens(detail));
    let overlap = 0;
    labelTokens.forEach((token) => {
        if (detailTokens.has(token)) overlap += 1;
    });
    const containment = overlap / Math.max(1, labelTokens.size);
    return words(detail).length >= Math.max(9, words(label).length + 4)
        || (containment < 0.8 && words(detail).length >= 7);
}

function buildInteractionPoints(slide) {
    const source = slide && typeof slide === 'object' ? slide : {};
    const points = Array.isArray(source.keyPoints) ? source.keyPoints.map(clean).filter(Boolean) : [];
    const authored = Array.isArray(source.interactionPoints) ? source.interactionPoints : [];
    const sentences = sentenceChunks(source.content).map(clean).filter(Boolean);
    const usedIndexes = new Set();

    return points.map((point, index) => {
        const authoredPoint = authored[index] && typeof authored[index] === 'object' ? authored[index] : {};
        const label = conciseInteractionLabel(authoredPoint.label || point, index);
        let detail = clean(authoredPoint.detail);

        if (!interactionDetailIsDistinct(label, detail)) {
            const match = supportingSentence(point, sentences, usedIndexes);
            if (match) {
                usedIndexes.add(match.index);
                detail = match.sentence;
                const next = sentences[match.index + 1];
                if (!interactionDetailIsDistinct(label, detail) && next && !usedIndexes.has(match.index + 1)) {
                    detail = clean(`${detail} ${next}`);
                    usedIndexes.add(match.index + 1);
                }
            }
        }

        if (!interactionDetailIsDistinct(label, detail)) {
            const fallbackIndex = sentences.findIndex((sentence, sentenceIndex) => (
                !usedIndexes.has(sentenceIndex) && interactionDetailIsDistinct(label, sentence)
            ));
            if (fallbackIndex >= 0) {
                detail = sentences[fallbackIndex];
                usedIndexes.add(fallbackIndex);
            }
        }

        if (!interactionDetailIsDistinct(label, detail)) {
            detail = clean(source.content) || clean(point);
        }

        return {
            label,
            detail: trimToWordBudget(detail, INTERACTION_POINT_WORD_LIMIT)
        };
    });
}

function enrichInteractiveKeyPoints(slide) {
    return buildInteractionPoints(slide).map((point) => point.label);
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

function isScenarioDecision(slide, templateId) {
    if (templateId !== 'scenario-learning') return false;
    const screenType = String(slide?.screenType || '').toLowerCase();
    const interactionType = String(slide?.interaction?.type || '').toLowerCase();
    return screenType === 'scenario' || interactionType === 'decision_explore';
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

    // Interactive cards benefit from richer teaser copy. Scenario decisions are
    // different: their keyPoints are learner responses authored as short choices.
    // Expanding them back into body sentences destroys the decision experience.
    const enrichPoints = templateId === 'highly-interactive'
        || (templateId === 'scenario-learning' && !isScenarioDecision(source, templateId));

    return {
        ...source,
        ...(enrichPoints ? { keyPoints: enrichInteractiveKeyPoints(source) } : {}),
        interactionPoints: buildInteractionPoints(source),
        displayContent: templateId === 'highly-interactive'
            ? trimToTeachingBudget(source.content, maxWords)
            : trimToWordBudget(source.content, maxWords),
        displayContentWordLimit: maxWords
    };
}

function fitTemplatePresentationContent(analysis, binding) {
    const source = analysis && typeof analysis === 'object' ? analysis : {};
    const template = getCourseTemplate(binding?.templateId);

    return {
        ...source,
        slides: (Array.isArray(source.slides) ? source.slides : [])
            .map((slide) => {
                if (template.id === 'professional-classic') {
                    return {
                        ...slide,
                        keyPoints: enrichInteractiveKeyPoints(slide),
                        interactionPoints: buildInteractionPoints(slide)
                    };
                }
                return fitSlidePresentationContent(slide, template.id);
            })
    };
}

module.exports = {
    BODY_WORD_BUDGETS,
    INTERACTION_LABEL_WORD_LIMIT,
    INTERACTION_POINT_WORD_LIMIT,
    buildInteractionPoints,
    conciseInteractionLabel,
    enrichInteractiveKeyPoints,
    enrichHighlyInteractiveKeyPoints,
    fitSlidePresentationContent,
    fitTemplatePresentationContent,
    isScenarioDecision,
    layoutBudget,
    trimToTeachingBudget,
    trimToWordBudget
};
