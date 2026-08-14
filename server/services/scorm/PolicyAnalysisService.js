/**
 * Server-side policy/PDF/PPT -> visual learning analysis.
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    detailed: { slides: '8-12', screenWords: '65-95', minWords: 50 },
    condensed: { slides: '5-7', screenWords: '52-78', minWords: 42 },
    summary: { slides: '3-4', screenWords: '42-65', minWords: 34 }
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
    const config = { responseMimeType: 'application/json' };
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
    const seenTitles = new Set();
    let duplicateTitles = 0;

    for (const slide of slides) {
        if (wordCount(slide?.content) < minWords) thin += 1;

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
        const seenPoints = new Set();
        for (const point of points) {
            if (wordCount(point) > pointLimit) overlongPoints += 1;
            const key = normalizedText(point);
            if (key && seenPoints.has(key)) duplicatePoints += 1;
            if (key) seenPoints.add(key);
        }
    }

    const issues = [];
    if (thin > allowance) issues.push(`${thin} screens are too thin for the selected detail level.`);
    if (weakPoints > allowance) issues.push(`${weakPoints} screens have fewer than three useful visual points.`);
    if (overlongPoints > allowance) issues.push(`${overlongPoints} visual points are too long to display cleanly in diagrams.`);
    if (genericTitles > allowance) issues.push(`${genericTitles} screen titles are generic rather than message-led.`);
    if (duplicatePoints > 0) issues.push('At least one screen repeats the same supporting point.');
    if (duplicateTitles > 0) issues.push('At least one screen title is duplicated.');

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

function parseAnalysis(text) {
    let analysis;
    try {
        analysis = JSON.parse(text || '{}');
    } catch (_) {
        const e = new Error('Gemini returned invalid JSON');
        e.code = 'GEMINI_BAD_JSON';
        throw e;
    }
    if (!analysis.title || !Array.isArray(analysis.slides) || !Array.isArray(analysis.quiz)) {
        const e = new Error('Gemini analysis missing required fields (title, slides, quiz)');
        e.code = 'GEMINI_INCOMPLETE';
        throw e;
    }
    return analysis;
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
    } else {
        sourceParts.push({ inlineData: { data: fileBase64, mimeType: mimeType || 'application/pdf' } });
    }

    const instruction = `You are a world-class instructional designer, learning storyteller and presentation architect. Transform this source into a ${detailLevel} premium digital learning experience. It must feel authored, purposeful and easy to learn from — not like a document automatically chopped into slides.

QUALITY BAR:
Think a polished Articulate Storyline lesson combined with a modern editorial presentation. Every screen should answer three learner questions: What is this? Why does it matter here? What should I notice, decide or do? Keep the explanatory copy substantial, but keep the visual labels extremely scannable so the diagrams remain readable on laptops and phones.

Create a learning arc:
- Begin with relevance: why this topic matters to the learner.
- Build concepts in a logical sequence with clear transitions.
- Explain practical meaning rather than repeating definitions.
- Use source-supported examples, consequences and micro-scenarios where available.
- Translate rules into observable learner behaviour.
- End major ideas with a memorable action, decision or takeaway.
- Avoid filler, repetition, corporate jargon and vague motivational language.

1. LEARNING SCREENS (generate ${level.slides} screens):
   - "title": concise, specific, human and message-led. Prefer a useful message over a generic topic label.
   - "content": approximately ${level.screenWords} words. Usually 2–4 well-shaped sentences or two short paragraphs. Explain meaning, relevance, practical context, consequence and/or the learner action supported by the source. Do not turn the body into a bullet list and do not repeat every keyPoint in sentence form.
   - "keyPoints": 3–5 concise supporting points that are visually scannable and add information rather than repeating the paragraph.
       * process / timeline / cycle: target 3–8 words per point.
       * matrix: target 2–8 words per point.
       * hub: target 4–10 words per point.
       * cards: target 4–11 words per point.
       * comparison / spotlight: target 4–12 words per point.
       * Treat these as visual labels, not miniature paragraphs.
   - "layout": choose exactly one of: "process", "cards", "timeline", "comparison", "hub", "spotlight", "matrix", "cycle".
   - Match layout to meaning:
       process = ordered steps, workflow, attack flow or how something works
       timeline = stages, phases or a journey over time
       comparison = safe vs unsafe, recommended vs risky, correct vs incorrect behaviour
       hub = sibling categories, components, pillars or related concepts
       spotlight = one critical warning, action, insight or takeaway
       cards = independent concepts, tips or items
       matrix = likelihood vs impact, severity, prioritisation or risk categories only when the source supports those dimensions
       cycle = a genuinely repeating lifecycle or continuous process
   - Vary visual rhythm. Avoid the same layout on consecutive screens unless the source genuinely requires it.
   - "visualTitle": 2–5 words that remain readable in the centre of a diagram.
   - "interaction": object with "type" from "step_explore", "hotspot_explore", "compare_reveal", "focus_reveal", plus a short action-oriented "prompt".
   - "imageQuery": a short 2–3 word keyword for compatibility.

2. WRITING QUALITY:
   - Write for an intelligent busy learner. Use clear professional language and sentence case.
   - Prefer concrete verbs such as verify, report, protect, confirm, review, stop, compare and escalate.
   - Use the paragraph for explanation and the visual points for scanning. They should complement, not mirror, one another.
   - When the source supports it, turn abstract guidance into a short realistic situation: what the learner notices, what decision they face, and what the safe action is.
   - Aim for at least one source-grounded example, micro-scenario or consequence across every three learning screens when the source has enough detail.
   - Avoid generic AI phrases such as "In today's digital landscape", "It is important to note", "In conclusion" and "This section will discuss".
   - Never use empty titles such as "Introduction", "Overview", "Key Points", "Summary" or "Conclusion" unless the source explicitly requires that wording.
   - Never repeat a sentence from content inside keyPoints.
   - Do not invent statistics, dates, penalties, controls, examples or policy requirements.

3. VISUAL STORYTELLING:
   - Each screen gets one dominant visual idea. The visual shows structure; the paragraph explains meaning.
   - Process/timeline/cycle points must be correctly sequenced, parallel and short enough to scan.
   - Comparison points must be parallel and clearly separable into recommended versus risky behaviour.
   - Hub/cards must contain sibling concepts at a similar level of detail.
   - Matrix labels must be concise and only use matrix structure when likelihood/impact or equivalent dimensions are source-supported.
   - Spotlight screens should focus on one memorable insight rather than multiple unrelated ideas.
   - At least one third of screens should invite useful exploration, not decorative clicking.

4. LEARNER VALUE:
   - Prioritise what the learner needs to understand, notice, decide or do.
   - If the source contains a definition, explain its practical meaning.
   - If it contains a rule, explain how the learner should act.
   - If it contains a risk, explain the source-supported consequence or warning signal.
   - If it contains an example, use it to make the lesson concrete.
   - If several source sections say the same thing, consolidate them instead of creating repetitive screens.

5. QUIZ (generate 5–8 questions):
   - Test useful knowledge and decisions, not trivia or wording recall.
   - Prefer realistic scenario-based questions whenever the source supports a scenario.
   - Exactly 4 answer options per question.
   - Keep answer options concise, parallel in grammar and plausible. Do not make the correct answer obvious by length or tone.
   - "correctAnswer" is the 0-based correct option index.
   - "explanation": 1–2 source-grounded sentences, normally 15–40 words, that explain the decision and reinforce the correct behaviour. Never return only "Correct" or restate the answer verbatim.

6. SUMMARY:
   - "summary" should be a concise learner-facing orientation, not a document abstract. Explain what the learner will be able to recognise, decide or do after the lesson without promising unsupported outcomes.

7. OUTPUT must be valid JSON with keys: title, summary, slides, quiz.`;

    const baseParts = [...sourceParts, { text: instruction }];
    const candidates = modelCandidates();
    let lastStatus = 0;
    let lastBody = '';
    let lastModel = candidates[0];

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
            const text = response.raw?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
            let analysis = parseAnalysis(text);

            const initialIssues = qualityIssues(analysis, detailLevel);
            if (initialIssues.length) {
                const refinementPrompt = `QUALITY REFINEMENT PASS:\nThe draft is structurally usable but it misses part of the learner-experience quality bar. Issues detected: ${initialIssues.join(' ')}\n\nRevise the entire JSON using the original source above. Preserve factual accuracy and the learning sequence. Keep body copy within the requested ${level.screenWords} words. Make visual keyPoints substantially shorter than the paragraph and obey the layout-specific word limits. Replace generic or duplicated titles with source-grounded message titles. Remove repetition across screens. Ensure quiz questions have exactly four concise options, a valid correctAnswer index and a useful source-grounded explanation. Do not add unsupported facts. Return only the improved JSON.\n\nDRAFT JSON:\n${JSON.stringify(analysis)}`;
                try {
                    const refined = await callGemini({ apiKey, model, parts: [...baseParts, { text: refinementPrompt }] });
                    if (refined.res.ok) {
                        const refinedText = refined.raw?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
                        const candidate = parseAnalysis(refinedText);
                        const refinedIssues = qualityIssues(candidate, detailLevel);
                        if (refinedIssues.length < initialIssues.length) {
                            analysis = candidate;
                            logger.info('scorm_gemini_refined', {
                                module: 'scorm',
                                model,
                                issuesBefore: initialIssues.length,
                                issuesAfter: refinedIssues.length,
                                slides: analysis.slides.length
                            });
                        } else {
                            logger.warn('scorm_gemini_refinement_quality_plateau', {
                                module: 'scorm',
                                model,
                                issues: refinedIssues
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
                thinkingLevel: /^gemini-3(?:\.|-|$)/i.test(model) ? thinkingLevel() : 'model-default',
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
    analysisNeedsRefinement,
    qualityIssues,
    wordCount
};
