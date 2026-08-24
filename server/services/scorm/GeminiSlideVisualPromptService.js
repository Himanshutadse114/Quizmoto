const logger = require('../../utils/logger');

const DEFAULT_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest'
];

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
        'Create a prompt for ONE Wide 16:9 course illustration that communicates only the supplied lesson meaning.',
        'Use a simple, clean, professional object-based or abstract visual metaphor that can be understood at slide size.',
        'NON-HUMAN VISUAL ONLY: do not show people, faces, hands, bodies, silhouettes, portraits, avatars or human figures.',
        'ABSOLUTELY NO TEXT IN THE IMAGE: No words, letters, numbers, captions, labels, logos, brand names, watermarks, signs or readable interfaces.',
        'Use no vector art or infographic typography; the result should look like a polished raster course illustration.',
        'Do not introduce cybersecurity objects, locks, shields, warning signs, email envelopes, QR codes, malware symbols or devices unless the supplied lesson itself is genuinely about those concepts.',
        'Do not copy generic examples from unrelated domains. Choose objects, shapes, colours and relationships that directly express THIS lesson.',
        'Keep the composition uncluttered with one clear focal idea, 2 to 5 main visual elements, generous negative space, realistic or soft-3D styling and subtle premium corporate lighting.',
        'The final prompt must explicitly say 16:9, non-human, no text, no logos and no watermark.',
        'Return only ONE concise image-generation prompt as plain text, approximately 80 to 180 words. Do not return JSON, Markdown, code fences, headings or commentary.'
    ].join(' ');
}

function coverInstruction(analysis) {
    return [
        'You are the visual director for a professional digital learning course.',
        'Write ONLY a production-ready image-generation prompt for the course cover.',
        `COURSE TITLE: ${clean(analysis?.title) || 'Learning course'}`,
        `COURSE SUMMARY: ${excerpt(analysis?.summary, 1400)}`,
        sharedVisualRules(),
        'Represent the central subject of the whole course, not one isolated detail.',
        'Do not force a believable workplace scene unless the supplied course is actually workplace-based. Do not include the course title as text inside the image.'
    ].join('\n\n');
}

function slideInstruction(slide, analysis, slideIndex) {
    const keyPoints = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : []).map(clean).filter(Boolean).slice(0, 6);
    return [
        'You are the visual director for a professional digital learning course.',
        'Write ONLY a production-ready image-generation prompt for this ONE slide. Base the visual strictly on the supplied slide. Ignore unrelated topics from other courses.',
        `Course: ${clean(analysis?.title) || 'Learning course'}`,
        `Slide number: ${Number(slideIndex) + 1}`,
        `Slide topic: ${clean(slide?.title) || `Section ${Number(slideIndex) + 1}`}`,
        `What this slide teaches: ${excerpt(slide?.content || slide?.introText || slide?.revealText, 1800)}`,
        keyPoints.length ? `Key ideas: ${keyPoints.join(' | ')}` : '',
        clean(slide?.visualTitle) ? `Visual emphasis: ${clean(slide.visualTitle)}` : '',
        sharedVisualRules(),
        'The image must make sense beside this exact slide without relying on any words inside the image.'
    ].filter(Boolean).join('\n\n');
}

function batchInstruction(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    const slideBlocks = slides.map((slide, index) => {
        const points = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : []).map(clean).filter(Boolean).slice(0, 5);
        return [
            `SLIDE ${index + 1}`,
            `Title: ${clean(slide?.title) || `Section ${index + 1}`}`,
            `Lesson: ${excerpt(slide?.content || slide?.introText || slide?.revealText, 1100)}`,
            points.length ? `Key ideas: ${points.join(' | ')}` : '',
            clean(slide?.visualTitle) ? `Visual emphasis: ${clean(slide.visualTitle)}` : ''
        ].filter(Boolean).join('\n');
    }).join('\n\n');

    return [
        'You are the visual director for a professional digital learning course.',
        'Create the complete visual plan for the course in ONE response. Do not ask for follow-up information.',
        `COURSE TITLE: ${clean(analysis?.title) || 'Learning course'}`,
        `COURSE SUMMARY: ${excerpt(analysis?.summary, 1500)}`,
        slideBlocks,
        'For the cover and EVERY slide, create a different production-ready FLUX Schnell image prompt grounded only in that exact lesson.',
        sharedVisualRules(),
        'OUTPUT FORMAT — use exactly one record per line and no other text:',
        'COVER|||<cover prompt>',
        ...slides.map((_, index) => `SLIDE ${index + 1}|||<slide ${index + 1} prompt>`),
        'Do not use JSON. Do not use Markdown. Do not add explanations before or after the records.'
    ].filter(Boolean).join('\n\n');
}

function stripCodeFence(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('```')) return text;
    return text.replace(/^```(?:json|text|plaintext)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

function recoverPromptFromBrokenJson(value) {
    const text = String(value || '');
    const match = text.match(/["']prompt["']\s*:\s*["']([\s\S]*)/i);
    if (!match) return '';
    return clean(match[1]
        .replace(/["']\s*}\s*$/s, '')
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\'));
}

function normalizeVisualPrompt(value) {
    let text = stripCodeFence(value);
    if (!text) return '';
    if (/^\s*\{/.test(text)) {
        try {
            const parsed = JSON.parse(text);
            const prompt = clean(parsed?.prompt);
            if (prompt) return prompt;
        } catch (_) {
            const recovered = recoverPromptFromBrokenJson(text);
            if (recovered) return recovered;
        }
    }
    text = text.replace(/^\s*(?:prompt|image prompt)\s*:\s*/i, '').replace(/^['"]|['"]$/g, '');
    return clean(text);
}

function parseBatchPrompts(value, slideCount) {
    const source = stripCodeFence(value);
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let coverPrompt = '';
    const slidePrompts = new Array(Math.max(0, Number(slideCount) || 0)).fill('');

    for (const line of lines) {
        let match = line.match(/^COVER\s*\|\|\|\s*(.+)$/i);
        if (match) {
            coverPrompt = normalizeVisualPrompt(match[1]);
            continue;
        }
        match = line.match(/^SLIDE\s+(\d+)\s*\|\|\|\s*(.+)$/i);
        if (match) {
            const index = Number(match[1]) - 1;
            if (index >= 0 && index < slidePrompts.length) slidePrompts[index] = normalizeVisualPrompt(match[2]);
        }
    }

    const missing = [];
    if (coverPrompt.length < 60) missing.push('cover');
    slidePrompts.forEach((prompt, index) => { if (prompt.length < 60) missing.push(`slide ${index + 1}`); });
    return { coverPrompt, slidePrompts, missing };
}

function visualPromptError(message, code = 'GEMINI_VISUAL_PROMPT_INVALID') {
    const err = new Error(message);
    err.code = code;
    return err;
}

function isRetryableVisualOutputError(err) {
    return ['GEMINI_VISUAL_PROMPT_EMPTY', 'GEMINI_VISUAL_PROMPT_INVALID', 'GEMINI_RESPONSE_INVALID'].includes(err?.code);
}

async function requestGeminiText(instruction, maxOutputTokens, temperature = 0.22) {
    const key = apiKey();
    if (!key) {
        const err = new Error('Gemini API key is required to create slide-specific image prompts.');
        err.code = 'GEMINI_KEY_MISSING';
        throw err;
    }

    let lastError = null;
    for (const model of modelCandidates()) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const body = {
                    contents: [{ parts: [{ text: instruction }] }],
                    generationConfig: { temperature, maxOutputTokens }
                };
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const rawText = await response.text();
                if (!response.ok) {
                    const err = new Error(`Gemini visual prompt request failed (${response.status})`);
                    err.status = response.status;
                    err.body = rawText;
                    if (response.status === 404) { lastError = err; break; }
                    if (response.status === 429) err.code = 'GEMINI_QUOTA';
                    else if (response.status === 403) err.code = 'GEMINI_FORBIDDEN';
                    else err.code = 'GEMINI_API_ERROR';
                    throw err;
                }

                let payload;
                try { payload = JSON.parse(rawText); }
                catch (_) { throw visualPromptError('Gemini returned an invalid API response.', 'GEMINI_RESPONSE_INVALID'); }

                const candidateText = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim();
                if (!candidateText) throw visualPromptError('Gemini returned an empty visual prompt.', 'GEMINI_VISUAL_PROMPT_EMPTY');
                return { text: candidateText, model };
            } catch (err) {
                lastError = err;
                if (err?.status === 404) break;
                if (isRetryableVisualOutputError(err) && attempt === 0) continue;
                if (isRetryableVisualOutputError(err)) break;
                throw err;
            }
        }
    }
    const err = lastError || new Error('No Gemini model was available for visual prompts.');
    if (!err.code) err.code = 'GEMINI_MODEL_NOT_FOUND';
    throw err;
}

async function callGeminiForPrompt(instruction) {
    const result = await requestGeminiText(instruction, 700, 0.22);
    const prompt = normalizeVisualPrompt(result.text);
    if (!prompt || prompt.length < 80) throw visualPromptError('Gemini returned an incomplete visual prompt.');
    return { prompt, model: result.model };
}

async function generateCourseVisualPrompts(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    if (!slides.length) return { coverPrompt: '', slidePrompts: [], model: null };

    const existingCover = clean(analysis?.coverImagePrompt);
    const existingSlides = slides.map((slide) => clean(slide?.imagePrompt));
    if (existingCover && existingSlides.every(Boolean)) {
        return {
            coverPrompt: existingCover,
            slidePrompts: existingSlides,
            model: analysis?.visualPromptModel || slides.find((slide) => slide?.imagePromptModel)?.imagePromptModel || null,
            cached: true
        };
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const result = await requestGeminiText(batchInstruction(analysis), 7000, 0.18);
            const parsed = parseBatchPrompts(result.text, slides.length);
            if (parsed.missing.length) {
                throw visualPromptError(`Gemini visual plan was incomplete: ${parsed.missing.slice(0, 4).join(', ')}`);
            }
            return { coverPrompt: parsed.coverPrompt, slidePrompts: parsed.slidePrompts, model: result.model, cached: false };
        } catch (err) {
            lastError = err;
            logger.warn('scorm_gemini_batch_visual_plan_retry', { module: 'scorm', attempt: attempt + 1, error: err.message, code: err.code });
        }
    }
    throw lastError || visualPromptError('Gemini could not create the complete course visual plan.');
}

async function generateCoverVisualPrompt(analysis) {
    const cached = clean(analysis?.coverImagePrompt);
    if (cached) return { prompt: cached, model: analysis?.visualPromptModel || analysis?.coverImagePromptModel || 'gemini-precomputed', cached: true };
    return callGeminiForPrompt(coverInstruction(analysis));
}

async function generateSlideVisualPrompt(slide, analysis, slideIndex) {
    const cached = clean(slide?.imagePrompt);
    if (cached) return { prompt: cached, model: slide?.imagePromptModel || analysis?.visualPromptModel || 'gemini-precomputed', cached: true };
    return callGeminiForPrompt(slideInstruction(slide, analysis, slideIndex));
}

module.exports = {
    generateCoverVisualPrompt,
    generateSlideVisualPrompt,
    generateCourseVisualPrompts,
    coverInstruction,
    slideInstruction,
    batchInstruction,
    parseBatchPrompts,
    sharedVisualRules,
    modelCandidates,
    normalizeVisualPrompt,
    recoverPromptFromBrokenJson
};
