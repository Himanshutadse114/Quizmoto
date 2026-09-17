/**
 * Server-side policy/PDF/PPT -> professional visual learning analysis.
 * OpenAI API key stays on the server (OPENAI_API_KEY).
 */
const logger = require('../../utils/logger');
const {
    getApiKey: openAiApiKey,
    textModel,
    createStructuredResponse
} = require('../openai/OpenAiClient');
const {
    extractPptxText,
    extractDocumentText
} = require('../openai/DocumentTextExtractor');

/**
 * Course depth is intentionally expressed as an instructional-design contract,
 * not just a slide count. The author UI exposes concise/detailed/comprehensive;
 * condensed/summary remain supported for older callers.
 */
const DETAIL_CONFIG = {
    comprehensive: {
        slides: '14-18',
        minSlides: 12,
        screenWords: '160-210',
        minWords: 145,
        maxWords: 230,
        minPoints: 5,
        summaryMinWords: 80,
        summaryMaxWords: 120,
        quizExplanationMinWords: 30,
        minSentences: 7,
        hardSentenceWords: 23,
        maxAverageSentenceWords: 19,
        quizMin: 7,
        quizMax: 8,
        minScenarioRatio: 0.75,
        refinementPasses: 0
    },
    detailed: {
        slides: '10-14',
        minSlides: 9,
        screenWords: '135-175',
        minWords: 120,
        maxWords: 195,
        minPoints: 4,
        summaryMinWords: 70,
        summaryMaxWords: 110,
        quizExplanationMinWords: 28,
        minSentences: 6,
        hardSentenceWords: 23,
        maxAverageSentenceWords: 19,
        quizMin: 6,
        quizMax: 8,
        minScenarioRatio: 0.65,
        refinementPasses: 0
    },
    concise: {
        slides: '6-8',
        minSlides: 5,
        screenWords: '85-115',
        minWords: 75,
        maxWords: 135,
        minPoints: 3,
        summaryMinWords: 45,
        summaryMaxWords: 80,
        quizExplanationMinWords: 20,
        minSentences: 5,
        hardSentenceWords: 24,
        maxAverageSentenceWords: 20,
        quizMin: 5,
        quizMax: 7,
        minScenarioRatio: 0.5,
        refinementPasses: 0
    },
    condensed: {
        slides: '6-8',
        minSlides: 5,
        screenWords: '85-115',
        minWords: 75,
        maxWords: 135,
        minPoints: 3,
        summaryMinWords: 45,
        summaryMaxWords: 80,
        quizExplanationMinWords: 20,
        minSentences: 5,
        hardSentenceWords: 24,
        maxAverageSentenceWords: 20,
        quizMin: 5,
        quizMax: 7,
        minScenarioRatio: 0.5,
        refinementPasses: 0
    },
    summary: {
        slides: '4-5',
        minSlides: 4,
        screenWords: '65-90',
        minWords: 55,
        maxWords: 105,
        minPoints: 3,
        summaryMinWords: 35,
        summaryMaxWords: 65,
        quizExplanationMinWords: 16,
        minSentences: 4,
        hardSentenceWords: 24,
        maxAverageSentenceWords: 20,
        quizMin: 4,
        quizMax: 6,
        minScenarioRatio: 0.4,
        refinementPasses: 0
    }
};

const VISUAL_POINT_WORD_LIMITS = {
    process: 8,
    timeline: 8,
    cycle: 8,
    matrix: 8,
    hub: 10,
    cards: 11,
    comparison: 12,
    spotlight: 12
};

const GENERIC_TITLES = new Set([
    'introduction',
    'overview',
    'key points',
    'key takeaways',
    'summary',
    'conclusion',
    'important information',
    'things to remember',
    'what you need to know',
    'best practices'
]);

const GENERIC_FILLER_PATTERNS = [
    /in today'?s (?:digital|modern|fast[- ]paced) (?:world|landscape|environment)/i,
    /it is important to (?:note|remember|understand)/i,
    /it is crucial to/i,
    /stay vigilant/i,
    /remain vigilant/i,
    /plays? a (?:vital|crucial|key) role/i,
    /cannot be overstated/i,
    /this slide (?:explains|covers|shows)/i
];

const APPLICATION_PATTERN = /\b(for example|for instance|imagine|consider|such as|scenario|if you|if a|when you|when a|you receive|you notice|you are asked|a colleague|a customer|a vendor|a manager)\b/i;
const ACTION_PATTERN = /\b(verify|check|confirm|report|contact|stop|pause|do not|don['’]t|never|avoid|use|follow|escalate|review|validate|inspect|refuse|ask|notify|lock|protect|compare|open the official|navigate directly)\b/i;
const RATIONALE_PATTERN = /\b(because|which means|so that|works by|happens when|can lead to|may lead to|results? in|allows? an attacker|creates? a risk|reduces? the risk|prevents?|protects?|impact|consequence|exposure)\b/i;
const SCENARIO_QUESTION_PATTERN = /\b(you|your|colleague|employee|manager|customer|vendor|receive|notice|message|email|call|request|asked|prompt|link|attachment|what should|best action|first action|next step)\b/i;

const SEMANTIC_STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'before', 'by', 'can', 'do', 'does',
    'for', 'from', 'has', 'have', 'if', 'in', 'into', 'is', 'it', 'its', 'may', 'of', 'on', 'or',
    'that', 'the', 'their', 'then', 'this', 'through', 'to', 'use', 'when', 'where', 'which', 'while',
    'with', 'you', 'your'
]);

const SEMANTIC_CANONICAL_TERMS = new Map([
    ['checking', 'verify'], ['checked', 'verify'], ['check', 'verify'], ['confirm', 'verify'],
    ['confirmed', 'verify'], ['confirmation', 'verify'], ['validate', 'verify'], ['validation', 'verify'],
    ['reporting', 'report'], ['reported', 'report'], ['escalate', 'report'], ['escalation', 'report'],
    ['notify', 'report'], ['notification', 'report'], ['email', 'message'], ['emails', 'message'],
    ['messages', 'message'], ['requesting', 'request'], ['requests', 'request'], ['requested', 'request'],
    ['suspicion', 'suspicious'], ['uncertain', 'suspicious'], ['unusual', 'suspicious'],
    ['independently', 'trusted'], ['independent', 'trusted'], ['separate', 'trusted'], ['official', 'trusted'],
    ['credentials', 'credential'], ['passwords', 'credential'], ['password', 'credential']
]);

const LEARNING_CONCEPT_PATTERNS = {
    verify: /\b(verify|verification|confirm|confirmation|check|validate|trusted route|trusted channel|independent)\b/i,
    report: /\b(report|reporting|escalat(?:e|ed|es|ing|ion)|notify|designated route|security process)\b/i,
    pressure: /\b(urgency|urgent|pressure|rushed|immediate|secret|fear|authority|reward)\b/i,
    identity: /\b(sender|identity|impersonat(?:e|ed|es|ing|ion)|lookalike|domain|address|familiar person|manager|supplier)\b/i,
    unsafeContent: /\b(link|attachment|download|sign-in page|login page|open content|click)\b/i,
    payment: /\b(payment|bank|money|transfer value|account details|supplier account)\b/i,
    credentials: /\b(credential|password|sign in|login|sensitive information|confidential information)\b/i,
    normalProcess: /\b(normal process|usual process|approval|control|process change|established work process)\b/i,
    preserveEvidence: /\b(preserve|record what happened|message details|useful evidence|include useful)\b/i,
    stopAction: /\b(stop|pause|do not proceed|avoid clicking|refusing to be rushed)\b/i
};

const DEFAULT_MODEL_CANDIDATES = ['gpt-5.6-luna'];

const SCORM_ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        slides: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    learningPurpose: { type: 'string' },
                    content: { type: 'string' },
                    keyPoints: { type: 'array', items: { type: 'string' } },
                    layout: {
                        type: 'string',
                        enum: ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle']
                    },
                    visualTitle: { type: 'string' },
                    visualDirection: { type: 'string' },
                    interaction: {
                        type: 'object',
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['step_explore', 'hotspot_explore', 'compare_reveal', 'focus_reveal']
                            },
                            prompt: { type: 'string' }
                        },
                        required: ['type', 'prompt']
                    },
                    imageQuery: { type: 'string' }
                },
                required: ['title', 'learningPurpose', 'content', 'keyPoints', 'layout', 'visualTitle', 'visualDirection', 'interaction', 'imageQuery']
            }
        },
        quiz: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' } },
                    correctAnswer: { type: 'integer' },
                    explanation: { type: 'string' }
                },
                required: ['question', 'options', 'correctAnswer', 'explanation']
            }
        }
    },
    required: ['title', 'summary', 'slides', 'quiz']
};

async function extractTextFromPptx(base64Data) {
    try {
        return await extractPptxText(base64Data) || 'No text extracted from PowerPoint.';
    } catch (err) {
        logger.warn('scorm_pptx_extract_failed', { module: 'scorm', error: err.message });
        return 'Error extracting text from PowerPoint.';
    }
}

function getApiKey() {
    return openAiApiKey();
}

function normalizeDetailLevel(value) {
    const requested = String(value || 'detailed').trim().toLowerCase();
    if (DETAIL_CONFIG[requested]) return requested;
    if (requested === 'short') return 'concise';
    if (requested === 'full' || requested === 'deep') return 'comprehensive';
    return 'detailed';
}

function modelCandidates() {
    const preferred = textModel();
    return [preferred, ...DEFAULT_MODEL_CANDIDATES.filter((model) => model !== preferred)];
}

function thinkingLevel() {
    return 'none';
}

function generationConfigForModel(model) {
    return {
        model: String(model || textModel()),
        reasoning: { effort: 'none' },
        text: { format: { type: 'json_schema', name: 'scorm_course', strict: true, schema: SCORM_ANALYSIS_SCHEMA } },
        maxOutputTokens: 14000
    };
}

function openAiRequestTimeoutMs() {
    const configured = Number(process.env.OPENAI_SCORM_REQUEST_TIMEOUT_MS);
    if (!Number.isFinite(configured)) return 80000;
    return Math.max(1000, Math.min(180000, Math.round(configured)));
}

function templateInstruction(courseTemplateId, interactionLevel) {
    const templateId = String(courseTemplateId || '').trim().toLowerCase();
    const level = String(interactionLevel || '').trim().toLowerCase() || 'balanced';

    if (templateId === 'visual-product-training') {
        return `SELECTED COURSE EXPERIENCE: VISUAL PRODUCT TRAINING (${level.toUpperCase()} INTERACTION)\n\n- Write a visual-first product walkthrough where text supports inspection rather than becoming a conventional slide deck.\n- Use concise feature, component, screen, state or procedure titles.\n- Use 3-4 short key points as numbered visual callouts, ordered steps or comparison cues.\n- For products, equipment, interfaces or dashboards, make every key point something the learner can locate visually.\n- For procedures, use genuine ordered steps that can become a guided visual step rail. For two states, write a meaningful before/after or correct/incorrect comparison.\n- Do not invent controls, specifications, locations or workflow steps that are absent from the source.\n- Every screen must answer a visual question: what am I seeing, what matters, what changes, or what happens next?`;
    }

    if (templateId !== 'scenario-learning') return '';
    const scenarioTarget = level === 'high'
        ? 'About 35-50% of suitable screens should be genuine workplace decisions.'
        : level === 'balanced'
            ? 'About 25-35% of suitable screens should be genuine workplace decisions.'
            : 'Use a small number of genuine workplace decisions and keep the remainder as guided explanation.';
    return `SELECTED COURSE EXPERIENCE: SCENARIO LEARNING (${level.toUpperCase()} INTERACTION)\n\n- ${scenarioTarget}\n- Establish a concrete workplace moment before presenting choices.\n- On scenario screens, keyPoints must be 3-7 word response choices, decision factors or observable clues.\n- Include enough consequence and coaching in the body to explain why a response is safer, riskier or incomplete.\n- Do not force every screen into a decision. Keep definitions, procedures, comparisons and warning signs in the structure that teaches them best.\n- Do not invent organisation-specific policy, contacts, access rules or escalation routes.\n- Build a natural situation → judgement → consequence → safer-behaviour journey.`;
}

function wordCount(value) {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizedText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function semanticTokens(value) {
    return normalizedText(value)
        .split(' ')
        .map((token) => SEMANTIC_CANONICAL_TERMS.get(token) || token)
        .map((token) => {
            if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
            if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
            if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
            return token;
        })
        .filter((token) => token.length > 2 && !SEMANTIC_STOP_WORDS.has(token));
}

function semanticSimilarity(left, right) {
    const a = new Set(semanticTokens(left));
    const b = new Set(semanticTokens(right));
    if (a.size < 3 || b.size < 3) return 0;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection += 1;
    const union = a.size + b.size - intersection;
    const jaccard = union ? intersection / union : 0;
    const containment = intersection / Math.min(a.size, b.size);
    return Math.max(jaccard, containment * 0.92);
}

function learningConceptTags(value) {
    const text = String(value || '');
    return Object.entries(LEARNING_CONCEPT_PATTERNS)
        .filter(([, pattern]) => pattern.test(text))
        .map(([tag]) => tag);
}

function conceptSimilarity(left, right) {
    const a = new Set(learningConceptTags(left));
    const b = new Set(learningConceptTags(right));
    if (a.size < 2 || b.size < 2) return 0;
    let intersection = 0;
    for (const tag of a) if (b.has(tag)) intersection += 1;
    if (intersection < 2) return 0;
    return intersection / Math.min(a.size, b.size);
}

function semanticDuplicationIssues(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    const purposePairs = [];
    const pointPairs = [];
    const sentencePairs = [];

    for (let leftIndex = 0; leftIndex < slides.length; leftIndex += 1) {
        const left = slides[leftIndex] || {};
        const leftPurpose = String(left.learningPurpose || '').trim();
        const leftPoints = Array.isArray(left.keyPoints) ? left.keyPoints : [];
        const leftTeachingFocus = [left.title, leftPurpose, ...leftPoints].filter(Boolean).join(' ');
        const leftSentences = sentenceList(left.content).filter((sentence) => wordCount(sentence) >= 6);

        for (let rightIndex = leftIndex + 1; rightIndex < slides.length; rightIndex += 1) {
            const right = slides[rightIndex] || {};
            const rightPurpose = String(right.learningPurpose || '').trim();
            const rightPoints = Array.isArray(right.keyPoints) ? right.keyPoints : [];
            const rightTeachingFocus = [right.title, rightPurpose, ...rightPoints].filter(Boolean).join(' ');
            if (
                (leftPurpose && rightPurpose && semanticSimilarity(leftPurpose, rightPurpose) >= 0.6) ||
                conceptSimilarity(leftTeachingFocus, rightTeachingFocus) >= 0.74
            ) {
                purposePairs.push([leftIndex + 1, rightIndex + 1]);
            }

            for (const leftPoint of leftPoints) {
                for (const rightPoint of rightPoints) {
                    if (semanticSimilarity(leftPoint, rightPoint) >= 0.76) {
                        pointPairs.push([leftIndex + 1, rightIndex + 1]);
                    }
                }
            }

            const rightSentences = sentenceList(right.content).filter((sentence) => wordCount(sentence) >= 6);
            for (const leftSentence of leftSentences) {
                for (const rightSentence of rightSentences) {
                    if (semanticSimilarity(leftSentence, rightSentence) >= 0.86) {
                        sentencePairs.push([leftIndex + 1, rightIndex + 1]);
                    }
                }
            }
        }
    }

    const uniquePairCount = (pairs) => new Set(pairs.map((pair) => pair.join(':'))).size;
    const issues = [];
    const repeatedPurposes = uniquePairCount(purposePairs);
    const repeatedPoints = uniquePairCount(pointPairs);
    const repeatedSentences = uniquePairCount(sentencePairs);
    if (repeatedPurposes) issues.push(`${repeatedPurposes} screen pairs teach substantially the same primary lesson.`);
    if (repeatedPoints) issues.push(`${repeatedPoints} screen pairs contain semantically repeated supporting points.`);
    if (repeatedSentences) issues.push(`${repeatedSentences} screen pairs repeat substantially the same teaching sentence.`);
    return issues;
}

function semanticDuplicationScore(analysis) {
    return semanticDuplicationIssues(analysis).reduce((total, issue) => {
        const count = Number(String(issue || '').match(/^\d+/)?.[0] || 0);
        return total + count;
    }, 0);
}

function sentenceList(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.!?])\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
}

function averageSentenceWords(value) {
    const sentences = sentenceList(value);
    if (!sentences.length) return 0;
    return sentences.reduce((sum, sentence) => sum + wordCount(sentence), 0) / sentences.length;
}

function hasGenericFiller(value) {
    const text = String(value || '');
    return GENERIC_FILLER_PATTERNS.some((pattern) => pattern.test(text));
}

function instructionalSignals(value) {
    const text = String(value || '');
    return {
        application: APPLICATION_PATTERN.test(text),
        action: ACTION_PATTERN.test(text),
        rationale: RATIONALE_PATTERN.test(text)
    };
}

function courseWordCount(analysis) {
    return (Array.isArray(analysis?.slides) ? analysis.slides : [])
        .reduce((sum, slide) => sum + wordCount(slide?.content), 0);
}

/**
 * Mechanical checks are combined with instructional checks. A screen can no
 * longer pass just because it has enough words: it needs readable teaching,
 * application and a concrete learner behaviour.
 */
function qualityIssues(analysis, detailLevel) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    if (!slides.length) return ['No learning screens were generated.'];

    const normalizedLevel = normalizeDetailLevel(detailLevel);
    const level = DETAIL_CONFIG[normalizedLevel];
    const premium = normalizedLevel === 'detailed' || normalizedLevel === 'comprehensive';
    const allowance = premium ? 0 : Math.max(1, Math.floor(slides.length * 0.15));

    let thin = 0;
    let overfilled = 0;
    let weakStructure = 0;
    let weakPoints = 0;
    let overlongPoints = 0;
    let genericTitles = 0;
    let duplicatePoints = 0;
    let hardSentences = 0;
    let denseAverage = 0;
    let fillerSlides = 0;
    let missingApplication = 0;
    let missingAction = 0;
    let missingRationale = 0;
    let complexPunctuation = 0;
    let duplicateTitles = 0;
    let repeatedOpeners = 0;
    const seenTitles = new Set();
    const seenPointsAcrossCourse = new Set();
    const seenOpeners = new Set();

    for (const slide of slides) {
        const content = String(slide?.content || '').trim();
        const wc = wordCount(content);
        if (wc < level.minWords) thin += 1;
        if (wc > level.maxWords) overfilled += 1;

        const sentences = sentenceList(content);
        if (sentences.length < level.minSentences) weakStructure += 1;
        if (sentences.some((sentence) => wordCount(sentence) > level.hardSentenceWords)) hardSentences += 1;
        if (averageSentenceWords(content) > level.maxAverageSentenceWords) denseAverage += 1;
        if (/[;]{1,}|\([^)]{45,}\)/.test(content)) complexPunctuation += 1;
        if (hasGenericFiller(content)) fillerSlides += 1;

        const signals = instructionalSignals(content);
        if (!signals.application) missingApplication += 1;
        if (!signals.action) missingAction += 1;
        if (!signals.rationale) missingRationale += 1;

        const firstSentence = sentences[0] || '';
        const opener = normalizedText(firstSentence).split(' ').slice(0, 6).join(' ');
        if (opener && opener.split(' ').length >= 5) {
            if (seenOpeners.has(opener)) repeatedOpeners += 1;
            seenOpeners.add(opener);
        }

        const title = normalizedText(slide?.title);
        if (GENERIC_TITLES.has(title)) genericTitles += 1;
        if (title) {
            if (seenTitles.has(title)) duplicateTitles += 1;
            seenTitles.add(title);
        }

        const points = Array.isArray(slide?.keyPoints)
            ? slide.keyPoints.filter((x) => String(x || '').trim())
            : [];
        if (points.length < level.minPoints) weakPoints += 1;

        const layout = String(slide?.layout || '').toLowerCase();
        const pointLimit = VISUAL_POINT_WORD_LIMITS[layout] || 11;
        for (const point of points) {
            const pointWords = wordCount(point);
            if (pointWords > pointLimit) overlongPoints += 1;
            if (pointWords > 0 && pointWords < 3) weakPoints += 1;
            const key = normalizedText(point);
            if (key && seenPointsAcrossCourse.has(key)) duplicatePoints += 1;
            if (key) seenPointsAcrossCourse.add(key);
        }
    }

    const issues = [];
    const summaryWords = wordCount(analysis?.summary);
    if (summaryWords < level.summaryMinWords) {
        issues.push(`The course summary is too short. It must explain the purpose, learner outcomes and practical value in at least ${level.summaryMinWords} words.`);
    }
    if (summaryWords > level.summaryMaxWords) {
        issues.push(`The course summary is too long. Keep it focused and learner-facing at about ${level.summaryMinWords}-${level.summaryMaxWords} words.`);
    }
    if (slides.length < level.minSlides && premium) {
        issues.push(`The ${normalizedLevel} course has only ${slides.length} learning screens. Where the source supports it, separate distinct concepts and decisions to create at least ${level.minSlides} substantial screens without padding.`);
    }
    if (thin > allowance) issues.push(`${thin} screens are under-developed. Expand them with source-grounded explanation, application, consequence and learner action.`);
    if (overfilled > allowance) issues.push(`${overfilled} screens are overloaded. Split ideas into shorter teaching sentences or separate distinct concepts into another screen.`);
    if (weakStructure > allowance) issues.push(`${weakStructure} screens do not contain enough complete teaching sentences. Use at least ${level.minSentences} short sentences rather than one dense paragraph.`);
    if (hardSentences > allowance) issues.push(`${hardSentences} screens contain sentences over ${level.hardSentenceWords} words. Rewrite them as shorter, clearer sentences.`);
    if (denseAverage > allowance) issues.push(`${denseAverage} screens have an average sentence length that is too high. Aim for 12-18 words per sentence.`);
    if (complexPunctuation > allowance) issues.push(`${complexPunctuation} screens use semicolon chains or long parenthetical clauses. Rewrite them as direct sentences.`);
    if (fillerSlides > 0) issues.push(`${fillerSlides} screens contain generic AI-style filler. Replace it with topic-specific teaching.`);
    if (premium && missingApplication > allowance) issues.push(`${missingApplication} screens lack a concrete workplace example, situation or application.`);
    if (premium && missingAction > allowance) issues.push(`${missingAction} screens do not clearly tell the learner what to notice, verify, decide, report or do.`);
    if (premium && missingRationale > allowance) issues.push(`${missingRationale} screens do not adequately explain why the lesson matters or how the risk/mechanism works.`);
    if (weakPoints > allowance) issues.push(`${weakPoints} screens have weak visual points. Use ${level.minPoints}-5 concise, information-rich labels rather than stubs.`);
    if (overlongPoints > allowance) issues.push(`${overlongPoints} visual points are too long for clean diagrams.`);
    if (genericTitles > allowance) issues.push(`${genericTitles} screen titles are generic rather than message-led.`);
    if (duplicatePoints > 0) issues.push(`${duplicatePoints} supporting points repeat wording already used elsewhere.`);
    if (duplicateTitles > 0) issues.push('At least one screen title is duplicated.');
    if (repeatedOpeners > 0) issues.push(`${repeatedOpeners} screens begin with nearly identical sentence openings, which makes the course feel machine-written.`);
    if (slides.length && slides.every((slide) => String(slide?.learningPurpose || '').trim())) {
        issues.push(...semanticDuplicationIssues(analysis));
    }

    const quiz = Array.isArray(analysis?.quiz) ? analysis.quiz : [];
    if (quiz.length) {
        let malformedQuiz = 0;
        let scenarioQuestions = 0;
        const seenQuestions = new Set();
        for (const item of quiz) {
            const options = Array.isArray(item?.options) ? item.options : [];
            const optionKeys = options.map(normalizedText).filter(Boolean);
            const correct = Number(item?.correctAnswer);
            const questionKey = normalizedText(item?.question);
            const hasDuplicateQuestion = questionKey && seenQuestions.has(questionKey);
            if (questionKey) seenQuestions.add(questionKey);
            if (SCENARIO_QUESTION_PATTERN.test(String(item?.question || ''))) scenarioQuestions += 1;
            if (
                !questionKey ||
                wordCount(item?.question) < 8 ||
                options.length !== 4 ||
                new Set(optionKeys).size !== 4 ||
                !Number.isInteger(correct) ||
                correct < 0 ||
                correct >= options.length ||
                wordCount(item?.explanation) < level.quizExplanationMinWords ||
                hasDuplicateQuestion
            ) {
                malformedQuiz += 1;
            }
        }
        if (quiz.length < level.quizMin || quiz.length > level.quizMax) {
            issues.push(`The ${normalizedLevel} knowledge check should contain ${level.quizMin}-${level.quizMax} questions.`);
        }
        const scenarioRatio = quiz.length ? scenarioQuestions / quiz.length : 0;
        if (scenarioRatio < level.minScenarioRatio) {
            issues.push('Too many knowledge-check questions are recall-only. Convert more of them into realistic workplace decisions or scenarios.');
        }
        if (malformedQuiz) issues.push(`${malformedQuiz} quiz questions need stronger scenario wording, distinct options or fuller explanations.`);
    }

    return issues;
}

function analysisNeedsRefinement(analysis, detailLevel) {
    return qualityIssues(analysis, detailLevel).length > 0;
}

function jsonParseCandidates(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '').trim();
    const candidates = [];
    const add = (value) => {
        const candidate = String(value || '').trim();
        if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
    };
    add(raw);
    const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    add(unfenced);
    const firstBrace = unfenced.indexOf('{');
    const lastBrace = unfenced.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        const objectText = unfenced.slice(firstBrace, lastBrace + 1);
        add(objectText);
        add(objectText.replace(/,\s*([}\]])/g, '$1'));
    }
    return candidates;
}

function parseAnalysis(text) {
    let analysis = null;
    let parseError = null;
    for (const candidate of jsonParseCandidates(text)) {
        try {
            analysis = JSON.parse(candidate);
            parseError = null;
            break;
        } catch (err) {
            parseError = err;
        }
    }
    if (!analysis) {
        const e = new Error('OpenAI returned invalid JSON');
        e.code = 'OPENAI_BAD_JSON';
        e.cause = parseError || undefined;
        throw e;
    }
    if (!analysis.title || !Array.isArray(analysis.slides) || !Array.isArray(analysis.quiz)) {
        const e = new Error('OpenAI analysis missing required fields (title, slides, quiz)');
        e.code = 'OPENAI_INCOMPLETE';
        throw e;
    }
    return analysis;
}

function openAiCandidate(raw) {
    return {
        text: String(raw?.text || '').trim(),
        finishReason: 'completed',
        candidateCount: raw?.text ? 1 : 0,
        usage: raw?.usage || {},
        estimatedCostUsd: Number(raw?.estimatedCostUsd || 0),
        model: raw?.model || null
    };
}

async function callOpenAI({ model, parts, timeoutMs = openAiRequestTimeoutMs() }) {
    const content = [];
    for (const part of Array.isArray(parts) ? parts : []) {
        if (part?.text) content.push({ type: 'input_text', text: String(part.text) });
        const inline = part?.inlineData || part?.inline_data;
        if (inline?.data) {
            const mime = String(inline.mimeType || inline.mime_type || 'application/pdf');
            content.push({
                type: 'input_file',
                filename: mime.includes('pdf') ? 'source.pdf' : 'source.txt',
                file_data: `data:${mime};base64,${inline.data}`
            });
        }
    }
    const raw = await createStructuredResponse({
        model,
        input: [{ role: 'user', content }],
        instructions: 'Create source-grounded professional learning content. Return only the requested structured course object.',
        schema: SCORM_ANALYSIS_SCHEMA,
        schemaName: 'scorm_course',
        maxOutputTokens: 14000,
        timeoutMs,
        metadata: { workload: 'scorm_course_authoring' }
    });
    return { res: { ok: true, status: 200 }, raw };
}

function professionalInstruction(detailLevel, level) {
    return `You are a senior instructional designer, curriculum writer and adult-learning specialist. Create a polished ${detailLevel} digital course from the supplied source. The finished JSON must read like a course written by an experienced human learning designer, not an AI summary.

BEFORE WRITING:
- Silently build a coverage map of the source: core concepts, risks, mechanisms, warning signs, roles, required actions, decisions, procedures, exceptions and escalation/reporting routes.
- Turn that map into an exclusive screen ledger. Assign every fact, example, decision and behaviour to one primary screen only.
- Silently decide the best teaching sequence. Do not output the coverage map or planning notes.
- Give each learning screen one primary teaching purpose. Never create several screens that merely restate the same definition.
- A concept may be briefly referenced later for continuity, but it must not be retaught, paraphrased into another key point, or reused as filler.

SOURCE GROUNDING — NON-NEGOTIABLE:
- Treat the source as authoritative. Preserve names, responsibilities, required actions, ordered steps, thresholds, timeframes, exceptions and escalation routes when provided.
- Do not invent organisational policy facts, statistics, contacts, deadlines, legal requirements or technical claims.
- Generic workplace examples are allowed only to demonstrate an already-supported lesson. Clearly keep them generic and do not add policy facts.
- Prioritise source-specific information over generic security advice.

PROFESSIONAL COURSE FLOW:
Build a coherent journey rather than a collection of unrelated slides. Adapt the sequence to the subject, but normally progress through:
1) context and learner relevance;
2) essential concepts and language;
3) how the issue, process or threat actually works;
4) important variants, warning signs or decision factors;
5) realistic workplace application;
6) the correct response, verification or prevention behaviour;
7) reporting, escalation or follow-up where relevant;
8) reinforcement of the most important behaviour.
Do not create a weak recap-only slide just to increase the count.

COURSE SUMMARY:
- Write ${level.summaryMinWords}-${level.summaryMaxWords} words.
- In one focused learner-facing paragraph, explain what the course covers, why it matters, and what the learner will be able to recognise, decide or do.
- Do not repeat the full course title and do not use marketing language.

LEARNING SCREENS — target ${level.slides} screens when the source supports them:
- title: 4-10 words, specific and message-led. The title should communicate the lesson or decision, not a category label. Never use Introduction, Overview, Key Points, Summary, Conclusion or Best Practices.
- learningPurpose: one precise sentence naming the new capability or understanding taught only on this screen. Every learningPurpose must be materially different across the course.
- content: approximately ${level.screenWords} words. Each screen should normally contain ${level.minSentences}-9 complete teaching sentences.
- Use this instructional micro-structure naturally, not as labelled headings:
  • establish the concept, rule or situation in context;
  • explain how it works or why it creates value/risk;
  • include source-specific details, conditions, roles or steps;
  • apply the lesson to a realistic workplace situation or concrete example;
  • explain the consequence of a poor decision when relevant;
  • state exactly what the learner should notice, verify, decide, avoid, report or do.
- Do not write a dictionary definition followed by generic advice. Teach the reasoning that helps the learner make a decision.
- Do not use bullet lists inside content. The body must read as polished course prose.
- Do not repeat the same warning, verification advice, reporting instruction, example or consequence across several screens. Teach it fully once, then refer to it briefly without re-explaining it.

READABILITY — VERY IMPORTANT:
- Write for a non-technical adult at about an 8th-grade reading level without sounding childish.
- Prefer 12-18 words per sentence. Keep every sentence under ${level.hardSentenceWords} words whenever possible.
- One main idea per sentence. If a sentence needs several commas, split it.
- Avoid semicolons, long parenthetical clauses, stacked jargon and noun-heavy phrases.
- Define an acronym the first time it appears unless the source clearly assumes it is already known.
- Use active voice and concrete verbs.
- Use "you" naturally for learner actions, but do not begin every sentence or slide the same way.
- Avoid AI filler such as "In today's digital landscape", "It is important to note", "plays a crucial role", "cannot be overstated" and vague instructions to "stay vigilant".
- Never say "this slide" or describe the course-writing process.

VISUAL KEY POINTS:
- Provide ${level.minPoints}-5 keyPoints per screen.
- Each point should usually be 3-10 words and contain useful meaning on its own.
- Key points should support the visual and add recall value. Do not simply copy a sentence from content.
- Do not reuse the same key-point phrase on another screen.
- Do not create synonymous duplicates such as "check independently", "confirm another way" and "verify through a trusted route" on different screens unless each phrase teaches a genuinely different condition or method.
- Choose layout semantically: process=ordered steps; timeline=time/sequence; comparison=meaningful contrast; matrix=two-factor decisions; hub/cards=distinct categories; spotlight=one scenario or decisive lesson; cycle=recurring activity.
- visualTitle: 2-5 words that communicate the centre of the visual.
- visualDirection: 25-55 words describing a concrete, topic-specific scene, its main objects, environment, camera angle and composition. Keep the art style consistent, but make every screen use a different setting, object family and visual structure. Never default to repeated desk, laptop, phone, notebook, mug or plant arrangements.
- interaction: choose one of step_explore|hotspot_explore|compare_reveal|focus_reveal and write a short purposeful prompt.
- imageQuery: 2-3 specific keywords based on the actual screen meaning.

KNOWLEDGE CHECK:
- Generate ${level.quizMin}-${level.quizMax} questions with exactly four distinct options and a valid 0-based correctAnswer.
- At least ${Math.round(level.minScenarioRatio * 100)}% should be realistic workplace decision/scenario questions, not definition recall.
- The learner should need to apply the course lesson to choose the best action.
- Wrong options should be believable mistakes, not obviously silly answers.
- Explanations must be at least ${level.quizExplanationMinWords} words and normally 30-55 words. Explain why the correct choice is best, why the tempting alternative is risky where useful, and reinforce the behaviour.

FINAL SELF-REVIEW BEFORE OUTPUT:
- Check that every screen teaches something distinct and useful.
- Compare every learningPurpose, key point and teaching sentence against every other screen. Rewrite semantic repetition, not only identical wording.
- Check that every screen has enough substance, but no wall-of-text sentence chains.
- Check that the course moves from understanding to recognition to application and action.
- Check that source-specific details have not been lost.
- Check that examples do not introduce unsupported policy facts.
- Check that visualDirection changes the setting, composition and main object family from one generated image to the next.
- Check that a learner could act differently after taking the course.

OUTPUT:
Return only valid JSON with keys title, summary, slides and quiz. Do not output planning notes, markdown or commentary.`;
}

function refinementInstruction(analysis, issues, detailLevel, level) {
    return `SENIOR INSTRUCTIONAL EDITOR PASS:\nThe draft below is not yet publication quality. Fix the entire JSON as a professional course editor.\n\nQUALITY FINDINGS:\n- ${issues.join('\n- ')}\n\nEDITORIAL REQUIREMENTS:\n- Keep all source-grounded facts that are already correct. Do not invent facts.\n- Strengthen weak screens using additional explanation, reasoning, source details, application and learner action — never padding.\n- Aim for ${level.screenWords} words per screen, written as ${level.minSentences}-9 short sentences.\n- Keep sentences normally 12-18 words and below ${level.hardSentenceWords} words. Split dense clauses. Avoid semicolons.\n- Make the sequence feel like one coherent ${detailLevel} course, not independent AI summaries.\n- Give every screen a unique learningPurpose and one distinct lesson, application/example and learner behaviour.\n- Use ${level.minPoints}-5 concise visual key points. Remove exact and semantic repetition across screens.\n- Give every screen a concrete visualDirection with a distinct setting, object family, camera angle and composition.\n- Keep the summary within ${level.summaryMinWords}-${level.summaryMaxWords} words.\n- Use ${level.quizMin}-${level.quizMax} strong knowledge checks with mostly workplace scenarios and explanations of at least ${level.quizExplanationMinWords} words.\n- Return only the improved JSON.\n\nDRAFT:\n${JSON.stringify(analysis)}`;
}

function uniquenessRefinementInstruction(analysis, issues, detailLevel, level) {
    return `COURSE UNIQUENESS EDITOR PASS:\nThe draft repeats learning points or teaching language across screens. Rewrite it into a premium ${detailLevel} course with no redundant teaching.\n\nREPETITION FINDINGS:\n- ${issues.join('\n- ')}\n\nREQUIRED EDIT:\n- Preserve accurate source-grounded facts, the course title and the overall sequence.\n- Build an exclusive coverage ledger internally. Each fact, decision, example, consequence and behaviour must have one primary screen.\n- Give every screen a unique learningPurpose. If two screens have the same purpose, merge the useful reasoning into the stronger screen and use the other screen for a different source-supported lesson.\n- Remove semantic repetition, including paraphrases and synonyms. A repeated idea may receive one brief continuity reference, but it must not be retaught.\n- Rewrite keyPoints so every point contributes new recall value and no two screens carry the same advice in different words.\n- Keep each screen near ${level.screenWords} words and preserve practical examples, consequences and learner actions without padding.\n- Give every screen a 25-55 word visualDirection. Keep one premium art style, but vary setting, object family, camera angle and composition. Do not repeat generic desk, laptop, phone, notebook, mug or plant scenes.\n- Keep ${level.quizMin}-${level.quizMax} distinct knowledge checks. Avoid asking the same decision in different wording.\n- Return the complete improved JSON only.\n\nDRAFT:\n${JSON.stringify(analysis)}`;
}

async function analyzePolicy({
    fileBase64,
    mimeType,
    detailLevel = 'detailed',
    courseTemplateId = '',
    interactionLevel = ''
}) {
    const generationStartedAt = Date.now();
    const apiKey = getApiKey();
    if (!apiKey) {
        const e = new Error('OPENAI_API_KEY is not configured on the server.');
        e.code = 'OPENAI_KEY_MISSING';
        throw e;
    }

    const normalizedLevel = normalizeDetailLevel(detailLevel);
    const level = DETAIL_CONFIG[normalizedLevel];
    const sourceParts = [];
    const isPptx =
        (mimeType || '').includes('presentationml.presentation') ||
        (mimeType || '').includes('powerpoint') ||
        (mimeType || '').includes('vnd.ms-powerpoint');

    if (fileBase64) {
        let text = '';
        try {
            text = isPptx
                ? await extractTextFromPptx(fileBase64)
                : await extractDocumentText({ fileBase64, mimeType });
        } catch (error) {
            logger.warn('scorm_openai_source_text_extract_failed', { module: 'scorm', error: error.message });
        }
        if (text.trim()) {
            sourceParts.push({ text: `SOURCE DOCUMENT (locally extracted to control cost):\n\n${text}` });
        } else {
            const error = new Error('The uploaded document did not contain readable text. Upload a searchable PDF or text-based document so course cost stays predictable.');
            error.code = 'SCORM_SOURCE_TEXT_REQUIRED';
            throw error;
        }
    }

    const selectedTemplateInstruction = templateInstruction(courseTemplateId, interactionLevel);
    const instruction = `${professionalInstruction(normalizedLevel, level)}${selectedTemplateInstruction ? `\n\n${selectedTemplateInstruction}` : ''}`;
    const baseParts = [...sourceParts, { text: instruction }];
    if (!fileBase64 && !sourceParts.length) {
        baseParts.unshift({ text: 'SOURCE: Course brief will be provided by the caller context or prior messages.' });
    }

    const candidates = modelCandidates();
    let lastStatus = 0;
    let lastBody = '';
    let lastModel = candidates[0];
    let lastStructuredError = null;

    for (const model of candidates) {
        lastModel = model;
        let response;
        try {
            response = await callOpenAI({ model, parts: baseParts });
        } catch (netErr) {
            logger.error('scorm_openai_request_failed', { module: 'scorm', model, error: netErr.message, code: netErr.code || null });
            throw netErr;
        }

        if (response.res.ok) {
            const candidate = openAiCandidate(response.raw);
            let totalEstimatedCostUsd = candidate.estimatedCostUsd;
            let analysis;
            try {
                analysis = parseAnalysis(candidate.text);
            } catch (parseErr) {
                if (parseErr.code === 'OPENAI_BAD_JSON' || parseErr.code === 'OPENAI_INCOMPLETE') {
                    lastStructuredError = parseErr;
                    lastStatus = 200;
                    lastBody = parseErr.code;
                    logger.warn('scorm_openai_structured_output_invalid', {
                        module: 'scorm',
                        model,
                        code: parseErr.code,
                        finishReason: candidate.finishReason || 'unknown',
                        textLength: candidate.text.length
                    });
                    continue;
                }
                throw parseErr;
            }

            let issues = qualityIssues(analysis, normalizedLevel);
            for (let pass = 0; pass < level.refinementPasses && issues.length; pass += 1) {
                const beforeIssueCount = issues.length;
                const beforeWords = courseWordCount(analysis);
                const refinementPrompt = refinementInstruction(analysis, issues, normalizedLevel, level);
                try {
                    const refined = await callOpenAI({ model, parts: [...baseParts, { text: refinementPrompt }] });
                    if (!refined.res.ok) break;
                    const refinedCandidate = openAiCandidate(refined.raw);
                    totalEstimatedCostUsd += refinedCandidate.estimatedCostUsd;
                    const candidateAnalysis = parseAnalysis(refinedCandidate.text);
                    const candidateIssues = qualityIssues(candidateAnalysis, normalizedLevel);
                    const candidateWords = courseWordCount(candidateAnalysis);
                    const improved =
                        candidateIssues.length < beforeIssueCount ||
                        (candidateIssues.length === beforeIssueCount && candidateWords > beforeWords);
                    if (!improved) break;
                    analysis = candidateAnalysis;
                    issues = candidateIssues;
                    logger.info('scorm_openai_refined', {
                        module: 'scorm',
                        model,
                        pass: pass + 1,
                        issuesBefore: beforeIssueCount,
                        issuesAfter: issues.length,
                        wordsBefore: beforeWords,
                        wordsAfter: candidateWords
                    });
                } catch (refineErr) {
                    logger.warn('scorm_openai_refinement_failed', { module: 'scorm', model, pass: pass + 1, error: refineErr.message });
                    break;
                }
            }

            const uniquenessIssues = semanticDuplicationIssues(analysis);
            const uniquenessDeadlineMs = Math.min(85000, openAiRequestTimeoutMs() + 5000);
            const uniquenessRemainingMs = uniquenessDeadlineMs - (Date.now() - generationStartedAt);
            if (uniquenessIssues.length && uniquenessRemainingMs >= 8000) {
                const beforeUniquenessCount = semanticDuplicationScore(analysis);
                const uniquenessPrompt = uniquenessRefinementInstruction(
                    analysis,
                    uniquenessIssues,
                    normalizedLevel,
                    level
                );
                try {
                    const refined = await callOpenAI({
                        model,
                        parts: [...baseParts, { text: uniquenessPrompt }],
                        timeoutMs: Math.min(20000, uniquenessRemainingMs)
                    });
                    if (refined.res.ok) {
                        const refinedCandidate = openAiCandidate(refined.raw);
                        totalEstimatedCostUsd += refinedCandidate.estimatedCostUsd;
                        const candidateAnalysis = parseAnalysis(refinedCandidate.text);
                        const candidateUniquenessIssues = semanticDuplicationIssues(candidateAnalysis);
                        const candidateUniquenessCount = semanticDuplicationScore(candidateAnalysis);
                        const originalQualityCount = qualityIssues(analysis, normalizedLevel).length;
                        const candidateQualityCount = qualityIssues(candidateAnalysis, normalizedLevel).length;
                        const improved = candidateUniquenessCount < beforeUniquenessCount
                            && candidateQualityCount <= originalQualityCount + 1;
                        if (improved) {
                            analysis = candidateAnalysis;
                            issues = qualityIssues(analysis, normalizedLevel);
                        }
                        logger.info('scorm_openai_uniqueness_refined', {
                            module: 'scorm',
                            model,
                            accepted: improved,
                            issuesBefore: beforeUniquenessCount,
                            issuesAfter: candidateUniquenessCount,
                            issueTypesAfter: candidateUniquenessIssues.length
                        });
                    }
                } catch (refineErr) {
                    logger.warn('scorm_openai_uniqueness_refinement_failed', {
                        module: 'scorm',
                        model,
                        error: refineErr.message
                    });
                }
            } else if (uniquenessIssues.length) {
                logger.warn('scorm_openai_uniqueness_refinement_skipped_for_sla', {
                    module: 'scorm',
                    model,
                    issues: uniquenessIssues.length,
                    remainingMs: Math.max(0, uniquenessRemainingMs)
                });
            }

            analysis.aiProvider = 'openai';
            analysis.aiModel = candidate.model || model;
            analysis.aiUsage = candidate.usage;
            analysis.aiEstimatedCostUsd = totalEstimatedCostUsd;
            logger.info('scorm_openai_ok', {
                module: 'scorm',
                model,
                detailLevel: normalizedLevel,
                slides: analysis.slides.length,
                courseWords: courseWordCount(analysis),
                remainingQualityIssues: qualityIssues(analysis, normalizedLevel).length
            });
            return analysis;
        }

        lastStatus = response.res.status;
        lastBody = String(response.raw || '');
        logger.warn('scorm_openai_try_failed', { module: 'scorm', model, status: response.res.status, body: lastBody.slice(0, 300) });
        const retryable = response.res.status === 404;
        if (!retryable) break;
    }

    if (lastStructuredError && (!lastStatus || lastStatus === 200 || lastStatus === 404)) {
        const e = new Error('OpenAI could not produce a valid course structure. Please retry.');
        e.code = lastStructuredError.code || 'OPENAI_BAD_JSON';
        throw e;
    }

    const e = new Error(`OpenAI could not generate the course with ${lastModel}.`);
    e.code = 'OPENAI_API_ERROR';
    e.status = lastStatus;
    throw e;
}

module.exports = {
    analyzePolicy,
    getApiKey,
    extractTextFromPptx,
    normalizeDetailLevel,
    modelCandidates,
    thinkingLevel,
    generationConfigForModel,
    openAiRequestTimeoutMs,
    callOpenAI,
    DEFAULT_MODEL_CANDIDATES,
    DETAIL_CONFIG,
    VISUAL_POINT_WORD_LIMITS,
    SCORM_ANALYSIS_SCHEMA,
    analysisNeedsRefinement,
    qualityIssues,
    wordCount,
    sentenceList,
    averageSentenceWords,
    semanticTokens,
    semanticSimilarity,
    learningConceptTags,
    conceptSimilarity,
    semanticDuplicationIssues,
    semanticDuplicationScore,
    instructionalSignals,
    courseWordCount,
    professionalInstruction,
    refinementInstruction,
    uniquenessRefinementInstruction,
    jsonParseCandidates,
    parseAnalysis,
    openAiCandidate,
    templateInstruction
};
