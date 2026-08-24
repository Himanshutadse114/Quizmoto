/**
 * Server-side policy/PDF/PPT -> professional visual learning analysis.
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

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
        refinementPasses: 2
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
        refinementPasses: 2
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
        refinementPasses: 1
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
        refinementPasses: 1
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
        refinementPasses: 1
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

const DEFAULT_MODEL_CANDIDATES = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
];

const GEMINI_3_THINKING_LEVELS = new Set(['minimal', 'low', 'medium', 'high']);

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
                    content: { type: 'string' },
                    keyPoints: { type: 'array', items: { type: 'string' } },
                    layout: {
                        type: 'string',
                        enum: ['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle']
                    },
                    visualTitle: { type: 'string' },
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
                required: ['title', 'content', 'keyPoints', 'layout', 'visualTitle', 'interaction', 'imageQuery']
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
        const zip = await JSZip.loadAsync(base64Data, { base64: true });
        let fullText = '';
        const slideFiles = Object.keys(zip.files)
            .filter((n) => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'))
            .sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
                const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
                return numA - numB;
            });
        for (const slide of slideFiles) {
            const xmlText = await zip.file(slide).async('string');
            const textMatches = xmlText.match(/<a:t>([^<]+)<\/a:t>/g);
            if (textMatches) {
                fullText += textMatches.map((t) => t.replace(/<\/?a:t>/g, '')).join(' ') + '\n\n';
            }
        }
        return fullText || 'No text extracted from PowerPoint.';
    } catch (err) {
        logger.warn('scorm_pptx_extract_failed', { module: 'scorm', error: err.message });
        return 'Error extracting text from PowerPoint.';
    }
}

function getApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function normalizeDetailLevel(value) {
    const requested = String(value || 'detailed').trim().toLowerCase();
    if (DETAIL_CONFIG[requested]) return requested;
    if (requested === 'short') return 'concise';
    if (requested === 'full' || requested === 'deep') return 'comprehensive';
    return 'detailed';
}

function modelCandidates() {
    const preferred = (process.env.GEMINI_MODEL || '').trim();
    return preferred
        ? [preferred, ...DEFAULT_MODEL_CANDIDATES.filter((m) => m !== preferred)]
        : [...DEFAULT_MODEL_CANDIDATES];
}

function thinkingLevel() {
    const configured = String(process.env.GEMINI_SCORM_THINKING_LEVEL || 'medium').trim().toLowerCase();
    return GEMINI_3_THINKING_LEVELS.has(configured) ? configured : 'medium';
}

function generationConfigForModel(model) {
    const config = {
        responseMimeType: 'application/json',
        responseJsonSchema: SCORM_ANALYSIS_SCHEMA,
        maxOutputTokens: 32768,
        temperature: 0.28
    };
    if (/^gemini-3(?:\.|-|$)/i.test(String(model || ''))) {
        config.thinkingConfig = { thinkingLevel: thinkingLevel() };
    }
    return config;
}

function friendlyGeminiError(status, bodyText, lastModel) {
    if (status === 400 && /api key not valid|invalid api key/i.test(bodyText || '')) {
        return { message: 'Gemini API key is invalid. Create a key in Google AI Studio and set GEMINI_API_KEY on the backend.', code: 'GEMINI_KEY_INVALID' };
    }
    if (status === 403) return { message: 'Gemini API rejected the key (403). Check API access and backend key restrictions.', code: 'GEMINI_FORBIDDEN' };
    if (status === 404) return { message: `Gemini model not available (${lastModel || 'unknown'}). Configure a supported Flash model and redeploy.`, code: 'GEMINI_MODEL_NOT_FOUND' };
    if (status === 429) return { message: 'Gemini rate limit / quota exceeded. Wait and retry or review quota.', code: 'GEMINI_QUOTA' };
    if (/no longer available/i.test(bodyText || '')) return { message: 'Gemini model was retired. Configure a current Flash model and redeploy.', code: 'GEMINI_MODEL_RETIRED' };
    return { message: `Gemini API error (${status})${lastModel ? ` model=${lastModel}` : ''}`, code: 'GEMINI_API_ERROR' };
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
        const e = new Error('Gemini returned invalid JSON');
        e.code = 'GEMINI_BAD_JSON';
        e.cause = parseError || undefined;
        throw e;
    }
    if (!analysis.title || !Array.isArray(analysis.slides) || !Array.isArray(analysis.quiz)) {
        const e = new Error('Gemini analysis missing required fields (title, slides, quiz)');
        e.code = 'GEMINI_INCOMPLETE';
        throw e;
    }
    return analysis;
}

function geminiCandidate(raw) {
    const candidate = raw?.candidates?.[0] || {};
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
        .filter((part) => part && part.thought !== true)
        .map((part) => part.text || '')
        .join('')
        .trim();
    return {
        text,
        finishReason: String(candidate.finishReason || ''),
        candidateCount: Array.isArray(raw?.candidates) ? raw.candidates.length : 0
    };
}

async function callGemini({ apiKey, model, parts }) {
    const body = {
        contents: [{ parts }],
        generationConfig: generationConfigForModel(model)
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const raw = res.ok ? await res.json() : await res.text().catch(() => '');
    return { res, raw };
}

function professionalInstruction(detailLevel, level) {
    return `You are a senior instructional designer, curriculum writer and adult-learning specialist. Create a polished ${detailLevel} digital course from the supplied source. The finished JSON must read like a course written by an experienced human learning designer, not an AI summary.

BEFORE WRITING:
- Silently build a coverage map of the source: core concepts, risks, mechanisms, warning signs, roles, required actions, decisions, procedures, exceptions and escalation/reporting routes.
- Silently decide the best teaching sequence. Do not output the coverage map or planning notes.
- Give each learning screen one primary teaching purpose. Never create several screens that merely restate the same definition.

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
- Choose layout semantically: process=ordered steps; timeline=time/sequence; comparison=meaningful contrast; matrix=two-factor decisions; hub/cards=distinct categories; spotlight=one scenario or decisive lesson; cycle=recurring activity.
- visualTitle: 2-5 words that communicate the centre of the visual.
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
- Check that every screen has enough substance, but no wall-of-text sentence chains.
- Check that the course moves from understanding to recognition to application and action.
- Check that source-specific details have not been lost.
- Check that examples do not introduce unsupported policy facts.
- Check that a learner could act differently after taking the course.

OUTPUT:
Return only valid JSON with keys title, summary, slides and quiz. Do not output planning notes, markdown or commentary.`;
}

function refinementInstruction(analysis, issues, detailLevel, level) {
    return `SENIOR INSTRUCTIONAL EDITOR PASS:\nThe draft below is not yet publication quality. Fix the entire JSON as a professional course editor.\n\nQUALITY FINDINGS:\n- ${issues.join('\n- ')}\n\nEDITORIAL REQUIREMENTS:\n- Keep all source-grounded facts that are already correct. Do not invent facts.\n- Strengthen weak screens using additional explanation, reasoning, source details, application and learner action — never padding.\n- Aim for ${level.screenWords} words per screen, written as ${level.minSentences}-9 short sentences.\n- Keep sentences normally 12-18 words and below ${level.hardSentenceWords} words. Split dense clauses. Avoid semicolons.\n- Make the sequence feel like one coherent ${detailLevel} course, not independent AI summaries.\n- Each screen must teach one distinct lesson and include an application/example plus a clear behaviour when appropriate.\n- Use ${level.minPoints}-5 concise visual key points. Remove repeated wording.\n- Keep the summary within ${level.summaryMinWords}-${level.summaryMaxWords} words.\n- Use ${level.quizMin}-${level.quizMax} strong knowledge checks with mostly workplace scenarios and explanations of at least ${level.quizExplanationMinWords} words.\n- Return only the improved JSON.\n\nDRAFT:\n${JSON.stringify(analysis)}`;
}

async function analyzePolicy({ fileBase64, mimeType, detailLevel = 'detailed' }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        const e = new Error('GEMINI_API_KEY is not configured on the server.');
        e.code = 'GEMINI_KEY_MISSING';
        throw e;
    }

    const normalizedLevel = normalizeDetailLevel(detailLevel);
    const level = DETAIL_CONFIG[normalizedLevel];
    const sourceParts = [];
    const isPptx =
        (mimeType || '').includes('presentationml.presentation') ||
        (mimeType || '').includes('powerpoint') ||
        (mimeType || '').includes('vnd.ms-powerpoint');

    if (isPptx) {
        const text = await extractTextFromPptx(fileBase64);
        sourceParts.push({ text: `SOURCE DOCUMENT (extracted from PowerPoint):\n\n${text}` });
    } else if (fileBase64) {
        sourceParts.push({ inlineData: { data: fileBase64, mimeType: mimeType || 'application/pdf' } });
    }

    const instruction = professionalInstruction(normalizedLevel, level);
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
            response = await callGemini({ apiKey, model, parts: baseParts });
        } catch (netErr) {
            logger.error('scorm_gemini_network', { module: 'scorm', model, error: netErr.message });
            const e = new Error(`Gemini network error: ${netErr.message}`);
            e.code = 'GEMINI_NETWORK';
            throw e;
        }

        if (response.res.ok) {
            const candidate = geminiCandidate(response.raw);
            let analysis;
            try {
                analysis = parseAnalysis(candidate.text);
            } catch (parseErr) {
                if (parseErr.code === 'GEMINI_BAD_JSON' || parseErr.code === 'GEMINI_INCOMPLETE') {
                    lastStructuredError = parseErr;
                    lastStatus = 200;
                    lastBody = parseErr.code;
                    logger.warn('scorm_gemini_structured_output_invalid', {
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
                    const refined = await callGemini({ apiKey, model, parts: [...baseParts, { text: refinementPrompt }] });
                    if (!refined.res.ok) break;
                    const refinedCandidate = geminiCandidate(refined.raw);
                    const candidateAnalysis = parseAnalysis(refinedCandidate.text);
                    const candidateIssues = qualityIssues(candidateAnalysis, normalizedLevel);
                    const candidateWords = courseWordCount(candidateAnalysis);
                    const improved =
                        candidateIssues.length < beforeIssueCount ||
                        (candidateIssues.length === beforeIssueCount && candidateWords > beforeWords);
                    if (!improved) break;
                    analysis = candidateAnalysis;
                    issues = candidateIssues;
                    logger.info('scorm_gemini_refined', {
                        module: 'scorm',
                        model,
                        pass: pass + 1,
                        issuesBefore: beforeIssueCount,
                        issuesAfter: issues.length,
                        wordsBefore: beforeWords,
                        wordsAfter: candidateWords
                    });
                } catch (refineErr) {
                    logger.warn('scorm_gemini_refinement_failed', { module: 'scorm', model, pass: pass + 1, error: refineErr.message });
                    break;
                }
            }

            logger.info('scorm_gemini_ok', {
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
        logger.warn('scorm_gemini_try_failed', { module: 'scorm', model, status: response.res.status, body: lastBody.slice(0, 300) });
        const retryable = response.res.status === 404 || /not found|no longer available|not supported for generatecontent/i.test(lastBody);
        if (!retryable) break;
    }

    if (lastStructuredError && (!lastStatus || lastStatus === 200 || lastStatus === 404)) {
        const e = new Error('Gemini could not produce a valid course structure. Please retry.');
        e.code = lastStructuredError.code || 'GEMINI_BAD_JSON';
        throw e;
    }

    const friendly = friendlyGeminiError(lastStatus, lastBody, lastModel);
    const e = new Error(friendly.message);
    e.code = friendly.code;
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
    DEFAULT_MODEL_CANDIDATES,
    DETAIL_CONFIG,
    VISUAL_POINT_WORD_LIMITS,
    SCORM_ANALYSIS_SCHEMA,
    analysisNeedsRefinement,
    qualityIssues,
    wordCount,
    sentenceList,
    averageSentenceWords,
    instructionalSignals,
    courseWordCount,
    professionalInstruction,
    refinementInstruction,
    jsonParseCandidates,
    parseAnalysis,
    geminiCandidate
};
