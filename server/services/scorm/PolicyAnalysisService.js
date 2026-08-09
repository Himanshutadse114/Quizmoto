/**
 * Server-side port of policy-to-scorm-engine/geminiService.ts
 * Gemini API key stays on the server (GEMINI_API_KEY).
 */
const JSZip = require('jszip');
const logger = require('../../utils/logger');

const DETAIL_CONFIG = {
    detailed: { slides: '8-12', screenWords: '45-75' },
    condensed: { slides: '5-7', screenWords: '30-55' },
    summary: { slides: '3-4', screenWords: '20-40' }
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
    // Gemini 3.x accepts thinkingLevel. Older 2.5 fallbacks use a different
    // thinking-budget API, so do not send a 3.x-only field to them.
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
        text: `You are an expert instructional designer and visual learning architect. Transform this source into a ${detailLevel}, engaging corporate e-learning module.

The learner should feel they are moving through a professionally designed interactive course, NOT reading a document split into slides.

RULES — follow all of these strictly:

1. SLIDES (generate ${level.slides} learning screens):
   - "title": clear professional screen title, title case, concise.
   - "content": concise on-screen explanation, approximately ${level.screenWords} words. Do not write long essay paragraphs.
   - "keyPoints": 3–6 short learning points, preferably under 14 words each.
   - "layout": choose exactly one of: "process", "cards", "timeline", "comparison", "hub", "spotlight", "matrix", "cycle".
   - Pick the layout based on the meaning of the content:
       process = steps/workflow/attack flow/how something works
       timeline = stages/phases/journey/sequence over time
       comparison = safe vs unsafe, do vs don't, correct vs risky behavior
       hub = categories/components/pillars/related concepts around one idea
       spotlight = one critical warning, risk, action, or takeaway
       cards = independent concepts/tips/items
       matrix = likelihood vs impact, severity, prioritisation, risk categories
       cycle = repeating lifecycle, continuous improvement, recurring process
   - Vary layouts throughout the course. Do not use the same layout on consecutive screens unless necessary.
   - "visualTitle": 2–6 word central label suitable for a diagram or visual.
   - "interaction": an object with:
       "type": choose one of "step_explore", "hotspot_explore", "compare_reveal", "focus_reveal" based on the layout,
       "prompt": one short learner instruction, preferably under 14 words.
   - "imageQuery": retain a short 2–3 word visual keyword for compatibility, but the renderer uses deterministic vectors.

2. VISUAL WRITING:
   - Prefer short phrases that can fit inside cards, diagrams, timelines, matrices and process nodes.
   - Never repeat the same sentence in both content and keyPoints.
   - Make each screen teach one clear idea.
   - Where the policy describes a sequence, explicitly structure keyPoints in the correct order.
   - Where the policy describes contrasting behaviour, put recommended behaviour first and risky behaviour second.
   - Where the policy describes risk, structure keyPoints from lower concern to higher concern when appropriate.

3. ENGAGEMENT:
   - At least one third of the learning screens should naturally invite exploration rather than passive reading.
   - Do not invent facts, statistics, policy requirements, penalties, dates, or controls that are not supported by the source.
   - Interactions are for exploration only unless the source clearly supports a right/wrong decision.

4. QUIZ (generate 5–8 questions):
   - Test specific knowledge from the source.
   - 4 answer options per question.
   - "correctAnswer" is the 0-based index of the correct option.
   - "explanation": one concise explanation of why the correct answer is right.

5. OUTPUT must be valid JSON with keys: title, summary, slides, quiz.`
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