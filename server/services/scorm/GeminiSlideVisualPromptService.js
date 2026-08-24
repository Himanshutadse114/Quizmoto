const logger = require('../../utils/logger');

const DEFAULT_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
];

const PROMPT_SCHEMA = {
    type: 'object',
    properties: {
        prompt: { type: 'string' }
    },
    required: ['prompt']
};

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function excerpt(value, maxChars = 1800) {
    const text = clean(value);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars).replace(/\s+\S*$/, '').trim()}…`;
}

function apiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function modelCandidates() {
    const preferred = clean(process.env.GEMINI_VISUAL_PROMPT_MODEL || process.env.GEMINI_MODEL);
    return preferred ? [preferred, ...DEFAULT_MODELS.filter((model) => model !== preferred)] : [...DEFAULT_MODELS];
}

function sharedVisualRules() {
    return [
        'Create a prompt for ONE 16:9 course illustration that communicates only the supplied lesson meaning.',
        'Use a simple, clean, professional object-based or abstract visual metaphor that can be understood at slide size.',
        'NON-HUMAN ONLY: no people, faces, hands, bodies, silhouettes, portraits, avatars or human figures.',
        'NO TEXT IN THE IMAGE: no words, letters, numbers, captions, labels, logos, brand names, watermarks, signs or readable interfaces.',
        'Do not introduce cybersecurity objects, locks, shields, warning signs, email envelopes, QR codes, malware symbols or devices unless the supplied lesson itself is genuinely about those concepts.',
        'Do not copy generic examples from unrelated domains. Choose objects, shapes, colours and relationships that directly express THIS lesson.',
        'Keep the composition uncluttered with one clear focal idea, 2 to 5 main visual elements, generous negative space, realistic or soft-3D styling and subtle premium corporate lighting.',
        'The final prompt must explicitly say 16:9, non-human, no text, no logos and no watermark.'
    ].join(' ');
}

function coverInstruction(analysis) {
    return [
        'You are the visual director for a professional digital learning course.',
        'Write ONLY a production-ready image-generation prompt for the course cover.',
        `COURSE TITLE: ${clean(analysis?.title) || 'Learning course'}`,
        `COURSE SUMMARY: ${excerpt(analysis?.summary, 1400)}`,
        sharedVisualRules(),
        'Represent the central subject of the whole course, not one isolated detail. Do not include the course title as text inside the image.'
    ].join('\n\n');
}

function slideInstruction(slide, analysis, slideIndex) {
    const keyPoints = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : []).map(clean).filter(Boolean).slice(0, 6);
    return [
        'You are the visual director for a professional digital learning course.',
        'Write ONLY a production-ready image-generation prompt for this ONE slide. Base the visual strictly on the supplied slide. Ignore unrelated topics from other courses.',
        `COURSE CONTEXT: ${clean(analysis?.title) || 'Learning course'}`,
        `SLIDE NUMBER: ${Number(slideIndex) + 1}`,
        `SLIDE TITLE: ${clean(slide?.title) || `Section ${Number(slideIndex) + 1}`}`,
        `SLIDE LESSON: ${excerpt(slide?.content || slide?.introText || slide?.revealText, 1800)}`,
        keyPoints.length ? `KEY POINTS: ${keyPoints.join(' | ')}` : '',
        clean(slide?.visualTitle) ? `INTENDED EMPHASIS: ${clean(slide.visualTitle)}` : '',
        sharedVisualRules(),
        'The image must make sense beside this exact slide without relying on any words inside the image.'
    ].filter(Boolean).join('\n\n');
}

async function callGeminiForPrompt(instruction) {
    const key = apiKey();
    if (!key) {
        const err = new Error('Gemini API key is required to create slide-specific image prompts.');
        err.code = 'GEMINI_KEY_MISSING';
        throw err;
    }

    let lastError = null;
    for (const model of modelCandidates()) {
        try {
            const body = {
                contents: [{ parts: [{ text: instruction }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseJsonSchema: PROMPT_SCHEMA,
                    temperature: 0.22,
                    maxOutputTokens: 1200
                }
            };
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const text = await response.text();
            if (!response.ok) {
                const err = new Error(`Gemini visual prompt request failed (${response.status})`);
                err.status = response.status;
                err.body = text;
                if (response.status === 404) {
                    lastError = err;
                    continue;
                }
                if (response.status === 429) err.code = 'GEMINI_QUOTA';
                else if (response.status === 403) err.code = 'GEMINI_FORBIDDEN';
                else err.code = 'GEMINI_API_ERROR';
                throw err;
            }

            const payload = JSON.parse(text);
            const candidateText = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim();
            if (!candidateText) {
                const err = new Error('Gemini returned an empty visual prompt.');
                err.code = 'GEMINI_VISUAL_PROMPT_EMPTY';
                throw err;
            }
            const parsed = JSON.parse(candidateText);
            const prompt = clean(parsed?.prompt);
            if (!prompt || prompt.length < 80) {
                const err = new Error('Gemini returned an incomplete visual prompt.');
                err.code = 'GEMINI_VISUAL_PROMPT_EMPTY';
                throw err;
            }
            return { prompt, model };
        } catch (err) {
            lastError = err;
            if (err?.status === 404) continue;
            throw err;
        }
    }

    logger.warn('scorm_gemini_visual_prompt_models_exhausted', { module: 'scorm', error: lastError?.message });
    const err = lastError || new Error('No Gemini model was available for visual prompts.');
    if (!err.code) err.code = 'GEMINI_MODEL_NOT_FOUND';
    throw err;
}

async function generateCoverVisualPrompt(analysis) {
    return callGeminiForPrompt(coverInstruction(analysis));
}

async function generateSlideVisualPrompt(slide, analysis, slideIndex) {
    return callGeminiForPrompt(slideInstruction(slide, analysis, slideIndex));
}

module.exports = {
    generateCoverVisualPrompt,
    generateSlideVisualPrompt,
    coverInstruction,
    slideInstruction,
    sharedVisualRules,
    modelCandidates
};
