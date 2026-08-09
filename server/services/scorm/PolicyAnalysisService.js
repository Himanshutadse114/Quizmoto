/**
 * Server-side port of policy-to-scorm-engine/geminiService.ts
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    detailed: { slides: '8-12', screenWords: '35-65' },
    condensed: { slides: '5-7', screenWords: '28-50' },
    summary: { slides: '3-4', screenWords: '20-38' }
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
    if (status === 403) {
        return { message: 'Gemini API rejected the key (403). Check API access and backend key restrictions.', code: 'GEMINI_FORBIDDEN' };
    }
    if (status === 404) {
        return { message: `Gemini model not available (${lastModel || 'unknown'}). Configure a supported Flash model and redeploy.`, code: 'GEMINI_MODEL_NOT_FOUND' };
    }
    if (status === 429) {
        return { message: 'Gemini rate limit / quota exceeded. Wait and retry or review quota.', code: 'GEMINI_QUOTA' };
    }
    if (/no longer available/i.test(bodyText || '')) {
        return { message: 'Gemini model was retired. Configure a current Flash model and redeploy.', code: 'GEMINI_MODEL_RETIRED' };
    }
    return { message: `Gemini API error (${status})${lastModel ? ` model=${lastModel}` : ''}`, code: 'GEMINI_API_ERROR' };
}

async function analyzePolicy({ fileBase64, mimeType, detailLevel = 'detailed' }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        const e = new Error('GEMINI_API_KEY is not configured on the server.');
        e.code = 'GEMINI_KEY_MISSING';
        throw e;
    }

    const level = DETAIL_CONFIG[detailLevel] || DETAIL_CONFIG.detailed;
    const parts = [];
    const isPptx =
        (mimeType || '').includes('presentationml.presentation') ||
        (mimeType || '').includes('powerpoint') ||
        (mimeType || '').includes('vnd.ms-powerpoint');

    if (isPptx) {
        const text = await extractTextFromPptx(fileBase64);
        parts.push({ text: `SOURCE DOCUMENT (extracted from PowerPoint):\n\n${text}` });
    } else {
        parts.push({ inlineData: { data: fileBase64, mimeType: mimeType || 'application/pdf' } });
    }

    parts.push({
        text: `You are a world-class instructional designer, visual storyteller and presentation architect. Transform this source into a ${detailLevel} digital learning experience that feels authored, paced and designed — not like a document automatically chopped into slides.

QUALITY BAR:
The course should feel closer to a premium AI presentation or modern interactive story than a traditional LMS deck. Every screen must earn its place. Learners should want to continue because the narrative is clear, the visual structure changes naturally, and the copy is concise enough to scan but useful enough to remember.

Build a learning arc, not a list of pages:
- Start with a strong orientation or hook: why this topic matters to the learner.
- Move into the core concepts, risks, process or behaviours in a logical sequence.
- Use concrete practical wording and source-supported examples where available.
- End major sections with an action, takeaway, decision, checklist or memorable recap.
- Avoid repeating the same idea using different words.
- Do not create filler screens just to reach the requested count.

RULES — follow all of these strictly:

1. LEARNING SCREENS (generate ${level.slides} screens):
   - "title": strong, human, specific title. Prefer a message or idea over a generic topic label. Keep it concise.
   - "content": approximately ${level.screenWords} words. Write 1–3 short paragraphs or sentences with natural rhythm. No long essay blocks.
   - "keyPoints": 3–6 compact points, preferably under 12 words each. These must add value rather than repeat the content.
   - "layout": choose exactly one of: "process", "cards", "timeline", "comparison", "hub", "spotlight", "matrix", "cycle".
   - Pick the layout from the meaning of the content:
       process = steps/workflow/attack flow/how something works
       timeline = stages/phases/journey/sequence over time
       comparison = safe vs unsafe, do vs don't, correct vs risky behaviour
       hub = categories/components/pillars/related concepts around one idea
       spotlight = one critical warning, risk, action, insight or takeaway
       cards = independent concepts/tips/items
       matrix = likelihood vs impact, severity, prioritisation, risk categories
       cycle = repeating lifecycle, continuous improvement, recurring process
   - Vary visual rhythm. Do not use the same layout on consecutive screens unless the source genuinely requires it.
   - "visualTitle": 2–6 words that work as the central label of a diagram, not merely a copy of the screen title.
   - "interaction": an object with:
       "type": choose one of "step_explore", "hotspot_explore", "compare_reveal", "focus_reveal" based on the layout,
       "prompt": a short, purposeful learner instruction, preferably under 12 words.
   - "imageQuery": keep a short 2–3 word visual keyword for compatibility; the renderer uses deterministic vectors.

2. PRESENTATION-QUALITY WRITING:
   - Give each screen one dominant message that can be understood in a few seconds.
   - Use sentence case and natural professional language. Avoid bureaucratic wording unless it is a required policy phrase.
   - Prefer concrete verbs: verify, report, stop, review, protect, compare, escalate, confirm.
   - Convert dense source material into hierarchy: headline → explanation → visual points.
   - Never repeat the same sentence in content and keyPoints.
   - Never create a title such as "Introduction", "Overview", "Key Points", "Conclusion" or "Important Information" unless the source specifically requires it.
   - Avoid excessive colons, slash-heavy wording, and generic AI phrases such as "In today's digital landscape".

3. VISUAL STORYTELLING:
   - Structure points so the selected layout will look balanced and intentional.
   - For process/timeline/cycle, keyPoints must be in the correct sequence and similar in length.
   - For comparison, put recommended/safe behaviour first and risky behaviour second; keep both sides parallel in wording.
   - For hub/cards, use short sibling concepts of similar granularity.
   - For matrix, use concise labels that can fit clearly into four quadrants.
   - For spotlight, focus on one memorable action or insight rather than several unrelated points.
   - At least one third of the screens should invite exploration rather than passive reading.

4. LEARNER VALUE:
   - Prioritise what the learner needs to notice, decide or do — not every sentence in the source.
   - When the source contains examples, scenarios or consequences, use them to make the lesson more concrete.
   - When a source contains a rule, explain the practical behaviour the learner should follow.
   - Do not invent facts, statistics, policy requirements, penalties, dates, controls or examples not supported by the source.

5. QUIZ (generate 5–8 questions):
   - Test specific, useful knowledge from the source rather than trivia.
   - Prefer scenario-based or decision-based questions when supported by the source.
   - Exactly 4 answer options per question.
   - Make distractors plausible but clearly distinguishable using the source.
   - "correctAnswer" is the 0-based index of the correct option.
   - "explanation": one concise explanation that reinforces the learning point.

6. OUTPUT must be valid JSON with keys: title, summary, slides, quiz.`
    });

    const candidates = modelCandidates();
    let lastStatus = 0;
    let lastBody = '';
    let lastModel = candidates[0];

    for (const model of candidates) {
        lastModel = model;
        const body = {
            contents: [{ parts }],
            generationConfig: generationConfigForModel(model)
        };
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } catch (netErr) {
            logger.error('scorm_gemini_network', { module: 'scorm', model, error: netErr.message });
            const e = new Error(`Gemini network error: ${netErr.message}`);
            e.code = 'GEMINI_NETWORK';
            throw e;
        }

        if (res.ok) {
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
            let analysis;
            try {
                analysis = JSON.parse(text);
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

            logger.info('scorm_gemini_ok', {
                module: 'scorm',
                model,
                thinkingLevel: /^gemini-3(?:\.|-|$)/i.test(model) ? thinkingLevel() : 'model-default',
                slides: analysis.slides.length
            });
            return analysis;
        }

        lastStatus = res.status;
        lastBody = await res.text().catch(() => '');
        logger.warn('scorm_gemini_try_failed', { module: 'scorm', model, status: res.status, body: lastBody.slice(0, 300) });
        const retryable = res.status === 404 || /not found|no longer available|not supported for generatecontent/i.test(lastBody);
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
    DEFAULT_MODEL_CANDIDATES
};