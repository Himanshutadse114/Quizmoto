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

function stripCodeFence(value) {
    const text = String(value || '').trim();
    if (!text.startsWith('```')) return text;
    return text
        .replace(/^```(?:json|text|plaintext)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
}

function recoverPromptFromBrokenJson(value) {
    const text = String(value || '');
    const match = text.match(/["']prompt["']\s*:\s*["']([\s\S]*)/i);
    if (!match) return '';

    let prompt = match[1]
        .replace(/["']\s*}\s*$/s, '')
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
    return clean(prompt);
}

function normalizeVisualPrompt(value) {
    let text = stripCodeFence(value);
    if (!text) return '';

    // Backward compatibility: older Gemini calls requested JSON. Accept a valid
    // JSON wrapper, but never require JSON for the production path.
    if (/^\s*\{/.test(text)) {
        try {
            const parsed = JSON.parse(text);
            const prompt = clean(parsed?.prompt);
            if (prompt) return prompt;
        } catch (_) {
            // A response cut off inside {"prompt":"... can still contain a
            // perfectly usable image prompt. Recover the string rather than
            // failing the entire course generation.
            const recovered = recoverPromptFromBrokenJson(text);
            if (recovered) return recovered;
        }
    }

    text = text
        .replace(/^\s*(?:prompt|image prompt)\s*:\s*/i, '')
        .replace(/^['"]|['"]$/g, '');
    return clean(text);
}

function visualPromptError(message, code = 'GEMINI_VISUAL_PROMPT_INVALID') {
    const err = new Error(message);
    err.code = code;
    return err;
}

function isRetryableVisualOutputError(err) {
    return ['GEMINI_VISUAL_PROMPT_EMPTY', 'GEMINI_VISUAL_PROMPT_INVALID', 'GEMINI_RESPONSE_INVALID'].includes(err?.code);
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
        // Retry malformed/empty model output once before falling through to the
        // next configured Gemini model. This is cheap and prevents a single
        // truncated response from causing zero course images.
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const body = {
                    contents: [{ parts: [{ text: instruction }] }],
                    generationConfig: {
                        temperature: 0.22,
                        maxOutputTokens: 700
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
                        break;
                    }
                    if (response.status === 429) err.code = 'GEMINI_QUOTA';
                    else if (response.status === 403) err.code = 'GEMINI_FORBIDDEN';
                    else err.code = 'GEMINI_API_ERROR';
                    throw err;
                }

                let payload;
                try {
                    payload = JSON.parse(text);
                } catch (_) {
                    throw visualPromptError('Gemini returned an invalid API response.', 'GEMINI_RESPONSE_INVALID');
                }

                const candidate = payload?.candidates?.[0];
                const candidateText = candidate?.content?.parts?.map((part) => part?.text || '').join('').trim();
                if (!candidateText) {
                    throw visualPromptError('Gemini returned an empty visual prompt.', 'GEMINI_VISUAL_PROMPT_EMPTY');
                }

                const prompt = normalizeVisualPrompt(candidateText);
                if (!prompt || prompt.length < 80) {
                    throw visualPromptError('Gemini returned an incomplete visual prompt.', 'GEMINI_VISUAL_PROMPT_INVALID');
                }

                return { prompt, model };
            } catch (err) {
                lastError = err;
                if (err?.status === 404) break;
                if (isRetryableVisualOutputError(err) && attempt === 0) {
                    logger.warn('scorm_gemini_visual_prompt_retry', {
                        module: 'scorm',
                        model,
                        reason: err.code || err.message
                    });
                    continue;
                }
                if (isRetryableVisualOutputError(err)) break;
                throw err;
            }
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
    modelCandidates,
    normalizeVisualPrompt,
    recoverPromptFromBrokenJson
};
