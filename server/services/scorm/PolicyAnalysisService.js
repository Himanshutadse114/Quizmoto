/**
 * Server-side policy/PDF/PPT -> visual learning analysis.
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    detailed: { slides: '8-12', screenWords: '70-105', minWords: 58 },
    condensed: { slides: '5-7', screenWords: '58-88', minWords: 48 },
    summary: { slides: '3-4', screenWords: '48-76', minWords: 38 }
};

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

function analysisNeedsRefinement(analysis, detailLevel) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    if (!slides.length) return true;
    const minWords = (DETAIL_CONFIG[detailLevel] || DETAIL_CONFIG.detailed).minWords;
    let thin = 0;
    let weakPoints = 0;
    for (const slide of slides) {
        if (wordCount(slide?.content) < minWords) thin += 1;
        const points = Array.isArray(slide?.keyPoints) ? slide.keyPoints.filter((x) => String(x || '').trim()) : [];
        if (points.length < 3) weakPoints += 1;
    }
    const allowance = Math.max(1, Math.floor(slides.length * 0.15));
    return thin > allowance || weakPoints > allowance;
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

    const instruction = `You are a world-class instructional designer, learning storyteller and presentation architect. Transform this source into a ${detailLevel} premium digital learning experience. It must feel authored, substantial and worth reading — not like a document automatically chopped into slides.

QUALITY BAR:
Think Articulate Storyline combined with a polished modern AI presentation. Every learning screen must have enough substance to teach something meaningful. Do not create thin screens containing only a sentence or a few words. Also do not paste dense source text. Use a graceful hierarchy: strong title, useful paragraph, visual structure and concise supporting points.

Create a learning arc:
- Begin with relevance: why this topic matters to the learner.
- Build concepts in a logical sequence.
- Explain practical meaning, not just definitions.
- Use source-supported examples, consequences and scenarios where available.
- Translate rules into clear learner behaviour.
- End major ideas with a memorable action, decision or takeaway.
- Avoid filler, repetition and vague motivational language.

1. LEARNING SCREENS (generate ${level.slides} screens):
   - "title": concise, specific, human and meaningful. Prefer a message over a generic topic label.
   - "content": approximately ${level.screenWords} words. Write one polished paragraph or two short paragraphs. Each paragraph must add real instructional value by explaining what the idea means, why it matters, how it appears in practice, what can go wrong, or what the learner should do. Never return a slide with only a few words of body copy.
   - "keyPoints": 3–5 concise supporting points, preferably under 12 words each. They must add information rather than repeat the paragraph.
   - "layout": choose exactly one of: "process", "cards", "timeline", "comparison", "hub", "spotlight", "matrix", "cycle".
   - Match layout to meaning:
       process = steps/workflow/attack flow/how something works
       timeline = stages/phases/journey/sequence over time
       comparison = safe vs unsafe, do vs don't, correct vs risky behaviour
       hub = categories/components/pillars/related concepts around one idea
       spotlight = one critical warning, risk, action, insight or takeaway
       cards = independent concepts/tips/items
       matrix = likelihood vs impact, severity, prioritisation, risk categories
       cycle = repeating lifecycle, continuous improvement, recurring process
   - Vary visual rhythm. Avoid the same layout on consecutive screens unless the source genuinely requires it.
   - "visualTitle": 2–6 words suitable for the centre of a diagram.
   - "interaction": object with "type" from "step_explore", "hotspot_explore", "compare_reveal", "focus_reveal", plus a short purposeful "prompt".
   - "imageQuery": a short 2–3 word keyword for compatibility.

2. WRITING QUALITY:
   - Write for an intelligent busy learner. The copy should feel editorial, clear and confident.
   - Use natural professional language and sentence case.
   - Prefer concrete verbs: verify, report, protect, confirm, review, stop, compare, escalate.
   - Explain context and consequence when supported by the source.
   - Use examples or micro-scenarios when the source provides enough information.
   - Avoid generic AI phrases such as "In today's digital landscape" or "It is important to note".
   - Never use empty titles such as "Introduction", "Overview", "Key Points" or "Conclusion" unless the source explicitly requires them.
   - Never repeat a sentence from content inside keyPoints.
   - Do not invent statistics, dates, penalties, controls, examples or policy requirements.

3. VISUAL STORYTELLING:
   - Each screen gets one dominant visual idea. The visual and paragraph should complement each other, not duplicate each other.
   - Process/timeline/cycle points must be correctly sequenced and similar in length.
   - Comparison points should be parallel: recommended behaviour first, risky behaviour second.
   - Hub/cards should contain sibling concepts at the same level of detail.
   - Matrix labels must stay concise enough to fit clearly.
   - Spotlight screens should focus on one memorable insight.
   - At least one third of the screens should invite exploration.

4. LEARNER VALUE:
   - Prioritise what the learner needs to understand, notice, decide or do.
   - If the source contains a definition, explain its practical meaning.
   - If it contains a rule, explain how the learner should act.
   - If it contains a risk, explain the consequence or signal when supported.
   - If it contains an example, use it to make the lesson concrete.

5. QUIZ (generate 5–8 questions):
   - Test useful knowledge and decisions, not trivia.
   - Prefer realistic scenario-based questions when supported by the source.
   - Exactly 4 answer options.
   - Make distractors plausible but clearly distinguishable using the source.
   - "correctAnswer" is the 0-based correct option index.
   - "explanation": 1–2 concise sentences that reinforce why the answer is correct.

6. OUTPUT must be valid JSON with keys: title, summary, slides, quiz.`;

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

            if (analysisNeedsRefinement(analysis, detailLevel)) {
                const refinementPrompt = `QUALITY REFINEMENT PASS:\nThe draft below is structurally usable but some learning screens are too thin or lack enough supporting points. Revise the entire JSON using the original source above. Preserve factual accuracy and the overall learning sequence, but make every content screen substantial and worth reading. Keep body copy within the requested ${level.screenWords} words, use one graceful paragraph or two short paragraphs, and ensure 3–5 useful keyPoints on each screen. Do not add unsupported facts. Return only the improved JSON.\n\nDRAFT JSON:\n${JSON.stringify(analysis)}`;
                try {
                    const refined = await callGemini({ apiKey, model, parts: [...baseParts, { text: refinementPrompt }] });
                    if (refined.res.ok) {
                        const refinedText = refined.raw?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
                        const candidate = parseAnalysis(refinedText);
                        if (!analysisNeedsRefinement(candidate, detailLevel)) {
                            analysis = candidate;
                            logger.info('scorm_gemini_refined', { module: 'scorm', model, slides: analysis.slides.length });
                        } else {
                            logger.warn('scorm_gemini_refinement_still_thin', { module: 'scorm', model });
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
                slides: analysis.slides.length
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
    analysisNeedsRefinement,
    wordCount
};