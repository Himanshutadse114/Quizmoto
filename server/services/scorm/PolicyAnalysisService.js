/**
 * Server-side policy/PDF/PPT -> visual learning analysis.
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    // Body copy targets are intentionally rich: learners need real explanation,
    // not one-line stubs. keyPoints stay short visual labels (see VISUAL_POINT_*).
    detailed: { slides: '8-12', screenWords: '90-130', minWords: 72 },
    condensed: { slides: '5-7', screenWords: '70-100', minWords: 55 },
    summary: { slides: '3-4', screenWords: '55-80', minWords: 42 }
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
    'things to remember'
]);

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

function modelCandidates() {
    const preferred = (process.env.GEMINI_MODEL || '').trim();
    return preferred
        ? [preferred, ...DEFAULT_MODEL_CANDIDATES.filter((m) => m !== preferred)]
        : [...DEFAULT_MODEL_CANDIDATES];
}

function thinkingLevel() {
    const configured = String(process.env.GEMINI_SCORM_THINKING_LEVEL || 'low').trim().toLowerCase();
    return GEMINI_3_THINKING_LEVELS.has(configured) ? configured : 'low';
}

function generationConfigForModel(model) {
    const config = {
        responseMimeType: 'application/json',
        responseJsonSchema: SCORM_ANALYSIS_SCHEMA,
        maxOutputTokens: 32768,
        temperature: 0.35
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

function qualityIssues(analysis, detailLevel) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    if (!slides.length) return ['No learning screens were generated.'];

    const minWords = (DETAIL_CONFIG[detailLevel] || DETAIL_CONFIG.detailed).minWords;
    const allowance = Math.max(1, Math.floor(slides.length * 0.15));
    let thin = 0;
    let weakPoints = 0;
    let overlongPoints = 0;
    let genericTitles = 0;
    let duplicatePoints = 0;
    let hardSentences = 0;
    const seenTitles = new Set();
    let duplicateTitles = 0;
    const seenPointsAcrossCourse = new Set();

    for (const slide of slides) {
        if (wordCount(slide?.content) < minWords) thin += 1;

        const sentences = String(slide?.content || '').split(/(?<=[.!?])\s+/).filter(Boolean);
        if (sentences.some((sentence) => wordCount(sentence) > 28)) hardSentences += 1;

        const title = normalizedText(slide?.title);
        if (GENERIC_TITLES.has(title)) genericTitles += 1;
        if (title) {
            if (seenTitles.has(title)) duplicateTitles += 1;
            seenTitles.add(title);
        }

        const points = Array.isArray(slide?.keyPoints)
            ? slide.keyPoints.filter((x) => String(x || '').trim())
            : [];
        if (points.length < 3) weakPoints += 1;

        const layout = String(slide?.layout || '').toLowerCase();
        const pointLimit = VISUAL_POINT_WORD_LIMITS[layout] || 11;
        for (const point of points) {
            const wc = wordCount(point);
            if (wc > pointLimit) overlongPoints += 1;
            if (wc > 0 && wc < 3) weakPoints += 1;
            const key = normalizedText(point);
            if (key && seenPointsAcrossCourse.has(key)) duplicatePoints += 1;
            if (key) seenPointsAcrossCourse.add(key);
        }

        const bodyKey = normalizedText(String(slide?.content || '').slice(0, 120));
        if (bodyKey && bodyKey.length > 20) {
            if (seenPointsAcrossCourse.has(`body:${bodyKey}`)) duplicatePoints += 1;
            seenPointsAcrossCourse.add(`body:${bodyKey}`);
        }
    }

    const issues = [];
    if (thin > allowance) issues.push(`${thin} screens have body copy that is too short — expand each screen to the target word count with real explanation, consequence and learner action.`);
    if (weakPoints > allowance) issues.push(`${weakPoints} screens have weak visual points (need 3–5 points of 3–12 words each; never single-word stubs).`);
    if (overlongPoints > allowance) issues.push(`${overlongPoints} visual points are too long to display cleanly in diagrams.`);
    if (genericTitles > allowance) issues.push(`${genericTitles} screen titles are generic rather than message-led.`);
    if (duplicatePoints > 0) issues.push(`${duplicatePoints} supporting points repeat wording already used on another screen.`);
    if (duplicateTitles > 0) issues.push('At least one screen title is duplicated.');
    if (hardSentences > allowance) issues.push(`${hardSentences} screens contain sentences that are too long and dense for an easy reading level.`);

    const quiz = Array.isArray(analysis?.quiz) ? analysis.quiz : [];
    if (quiz.length) {
        let malformedQuiz = 0;
        const seenQuestions = new Set();
        for (const item of quiz) {
            const options = Array.isArray(item?.options) ? item.options : [];
            const correct = Number(item?.correctAnswer);
            const questionKey = normalizedText(item?.question);
            const hasDuplicateQuestion = questionKey && seenQuestions.has(questionKey);
            if (questionKey) seenQuestions.add(questionKey);
            if (
                !questionKey ||
                options.length !== 4 ||
                !Number.isInteger(correct) ||
                correct < 0 ||
                correct >= options.length ||
                wordCount(item?.explanation) < 6 ||
                hasDuplicateQuestion
            ) {
                malformedQuiz += 1;
            }
        }
        if (quiz.length < 5 || quiz.length > 8) issues.push('The knowledge check should contain 5–8 questions.');
        if (malformedQuiz) issues.push(`${malformedQuiz} quiz questions need stronger structure or explanations.`);
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

async function analyzePolicy({ fileBase64, mimeType, detailLevel = 'detailed' }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        const e = new Error('GEMINI_API_KEY is not configured on the server.');
        e.code = 'GEMINI_KEY_MISSING';
        throw e;
    }

    const level = DETAIL_CONFIG[detailLevel] || DETAIL_CONFIG.detailed;
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

    const instruction = `You are a world-class instructional designer. Transform this source into a ${detailLevel} premium digital learning experience.

QUALITY BAR: Every screen answers: What is this? Why does it matter? What should I notice, decide or do?

1. LEARNING SCREENS (generate ${level.slides} screens):
   - "title": concise, specific, message-led (never "Introduction" or "Overview").
   - "content": approximately ${level.screenWords} words of clear adult prose. Cover: (1) what this idea is, (2) why it matters in a real situation, (3) a concrete example or consequence from the source, (4) what the learner should notice, decide or do. Write 3–5 complete sentences. No bullet lists in the body.
   - "keyPoints": 3–5 concise visual labels (3–12 words each, never 1–2 word stubs). They must add information, not repeat the paragraph. Never reuse the same phrase on another screen.
   - "layout": one of process, cards, timeline, comparison, hub, spotlight, matrix, cycle.
   - "visualTitle": 2–5 words for the diagram centre.
   - "interaction": { "type": one of step_explore|hotspot_explore|compare_reveal|focus_reveal, "prompt": short action text }.
   - "imageQuery": 2–3 word keyword.

2. WRITING: Plain language, 8th-grade reading level. Short sentences (under 20 words). Concrete verbs. No filler like "In today's digital landscape".

3. QUIZ: 5–8 questions, exactly 4 options each, correctAnswer 0-based index, explanation 15–40 words grounded in the source.

4. OUTPUT: valid JSON with keys title, summary, slides, quiz. Do not invent facts not in the source.`;

    const baseParts = [...sourceParts, { text: instruction }];
    if (!fileBase64 && !sourceParts.length) {
        // Allow topic-only generation when no file is provided (brief mode)
        baseParts.unshift({ text: 'SOURCE: Course brief will be provided by the caller context or prior messages. Generate from the instructional goals above.' });
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

            const initialIssues = qualityIssues(analysis, detailLevel);
            if (initialIssues.length) {
                const refinementPrompt = `QUALITY REFINEMENT PASS:\nIssues: ${initialIssues.join(' ')}\n\nRevise the ENTIRE JSON. Expand thin screens to about ${level.screenWords} words. Replace 1–2 word keyPoints with 3–12 word labels. Remove repeated wording across screens. Keep titles message-led. Quiz: 5–8 questions, 4 options, valid correctAnswer, useful explanation. Do not invent facts. Return only improved JSON.\n\nDRAFT:\n${JSON.stringify(analysis)}`;
                try {
                    const refined = await callGemini({ apiKey, model, parts: [...baseParts, { text: refinementPrompt }] });
                    if (refined.res.ok) {
                        const refinedCandidate = geminiCandidate(refined.raw);
                        const candidateAnalysis = parseAnalysis(refinedCandidate.text);
                        if (qualityIssues(candidateAnalysis, detailLevel).length < initialIssues.length) {
                            analysis = candidateAnalysis;
                            logger.info('scorm_gemini_refined', {
                                module: 'scorm',
                                model,
                                issuesBefore: initialIssues.length,
                                issuesAfter: qualityIssues(analysis, detailLevel).length
                            });
                        }
                    }
                } catch (refineErr) {
                    logger.warn('scorm_gemini_refinement_failed', { module: 'scorm', model, error: refineErr.message });
                }
            }

            logger.info('scorm_gemini_ok', {
                module: 'scorm',
                model,
                slides: analysis.slides.length,
                remainingQualityIssues: qualityIssues(analysis, detailLevel).length
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
    jsonParseCandidates,
    parseAnalysis,
    geminiCandidate
};
