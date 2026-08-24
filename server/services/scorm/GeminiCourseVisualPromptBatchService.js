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

function excerpt(value, maxChars = 900) {
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

function visualRules() {
    return [
        'wide 16:9 professional course illustration',
        'simple non-human visual only',
        'no people, faces, hands, bodies, silhouettes, portraits or avatars',
        'no words, letters, numbers, captions, labels, logos, brand names, watermarks, signs or readable screens',
        'no unrelated cybersecurity objects unless the supplied lesson itself is about cybersecurity',
        '2 to 5 clear visual elements, one focal idea, clean negative space, polished realistic or soft-3D raster style'
    ].join('; ');
}

function fallbackPrompt({ title, content, keyPoints, courseTitle, role = 'slide' }) {
    const points = (Array.isArray(keyPoints) ? keyPoints : []).map(clean).filter(Boolean).slice(0, 4).join(', ');
    const meaning = excerpt(content, 700);
    const subject = clean(title) || clean(courseTitle) || 'learning concept';
    return clean([
        `Create a ${visualRules()}.`,
        role === 'cover'
            ? `Represent the overall course subject: ${clean(courseTitle) || subject}.`
            : `Represent only this slide topic: ${subject}.`,
        meaning ? `Lesson meaning: ${meaning}.` : '',
        points ? `Important ideas: ${points}.` : '',
        'Use a visual metaphor that directly communicates this meaning without relying on text.'
    ].filter(Boolean).join(' '));
}

function buildBatchInstruction(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    const blocks = slides.map((slide, index) => {
        const points = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : []).map(clean).filter(Boolean).slice(0, 5);
        return [
            `SLIDE ${index + 1}`,
            `Title: ${clean(slide?.title)}`,
            `Teaching: ${excerpt(slide?.content || slide?.introText || slide?.revealText, 1000)}`,
            points.length ? `Key ideas: ${points.join(' | ')}` : ''
        ].filter(Boolean).join('\n');
    }).join('\n\n');

    return [
        'You are the visual director for a professional digital learning course.',
        'Create ALL image-generation prompts for the course in ONE response. Each prompt must be based only on the supplied course or slide meaning.',
        'Do not create generic cybersecurity imagery for a non-cyber course.',
        `Every prompt must require: ${visualRules()}.`,
        'Each prompt should be one concise production-ready sentence or short paragraph, about 45-95 words.',
        'Return EXACTLY one line per item using this format and no markdown:',
        'COVER|<cover image prompt>',
        'SLIDE_1|<slide 1 image prompt>',
        'SLIDE_2|<slide 2 image prompt>',
        'Continue through every supplied slide. Keep every prompt on a single line.',
        `COURSE TITLE: ${clean(analysis?.title) || 'Learning course'}`,
        `COURSE SUMMARY: ${excerpt(analysis?.summary, 1200)}`,
        blocks
    ].join('\n\n');
}

function parseBatchText(text, slideCount) {
    const result = { coverPrompt: '', slidePrompts: new Array(slideCount).fill('') };
    const lines = String(text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
        const cover = line.match(/^COVER\s*\|\s*(.+)$/i);
        if (cover) {
            result.coverPrompt = clean(cover[1]);
            continue;
        }
        const slide = line.match(/^SLIDE[_\s-]?(\d+)\s*\|\s*(.+)$/i);
        if (!slide) continue;
        const index = Number(slide[1]) - 1;
        if (Number.isInteger(index) && index >= 0 && index < slideCount) result.slidePrompts[index] = clean(slide[2]);
    }
    return result;
}

async function callGeminiBatch(instruction) {
    const key = apiKey();
    if (!key) {
        const err = new Error('Gemini API key is required to create course visual prompts.');
        err.code = 'GEMINI_KEY_MISSING';
        throw err;
    }

    let lastError = null;
    for (const model of modelCandidates()) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: instruction }] }],
                    generationConfig: {
                        temperature: 0.18,
                        maxOutputTokens: 8192
                    }
                })
            });
            const bodyText = await response.text();
            if (!response.ok) {
                const err = new Error(`Gemini visual batch request failed (${response.status})`);
                err.status = response.status;
                err.body = bodyText;
                if (response.status === 404) {
                    lastError = err;
                    continue;
                }
                if (response.status === 429) err.code = 'GEMINI_QUOTA';
                else if (response.status === 403) err.code = 'GEMINI_FORBIDDEN';
                else err.code = 'GEMINI_API_ERROR';
                throw err;
            }

            const payload = JSON.parse(bodyText);
            const text = payload?.candidates?.[0]?.content?.parts
                ?.filter((part) => part && part.thought !== true)
                .map((part) => part?.text || '')
                .join('')
                .trim();
            if (!text) {
                const err = new Error('Gemini returned an empty visual prompt batch.');
                err.code = 'GEMINI_VISUAL_PROMPT_EMPTY';
                throw err;
            }
            return { text, model };
        } catch (err) {
            lastError = err;
            if (err?.status === 404) continue;
            throw err;
        }
    }

    throw lastError || new Error('No Gemini model was available for course visual prompts.');
}

function hasCompletePromptPlan(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    return Boolean(clean(analysis?.coverImagePrompt)) && slides.length > 0 && slides.every((slide) => clean(slide?.imagePrompt));
}

async function ensureCourseVisualPrompts(rawAnalysis, opts = {}) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    analysis.slides = (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide) => ({ ...(slide || {}) }));
    if (!opts.force && hasCompletePromptPlan(analysis)) return analysis;

    const instruction = buildBatchInstruction(analysis);
    let model = null;
    let parsed = { coverPrompt: '', slidePrompts: new Array(analysis.slides.length).fill('') };
    let usedFallback = false;

    try {
        const response = await callGeminiBatch(instruction);
        model = response.model;
        parsed = parseBatchText(response.text, analysis.slides.length);
    } catch (err) {
        usedFallback = true;
        logger.warn('scorm_gemini_visual_batch_failed', { module: 'scorm', error: err.message, code: err.code || null });
    }

    analysis.coverImagePrompt = clean(parsed.coverPrompt) || fallbackPrompt({
        title: analysis.title,
        content: analysis.summary,
        courseTitle: analysis.title,
        role: 'cover'
    });
    analysis.coverImagePromptProvider = parsed.coverPrompt ? 'gemini' : 'local_fallback';
    analysis.coverImagePromptModel = parsed.coverPrompt ? model : null;

    analysis.slides = analysis.slides.map((slide, index) => {
        const prompt = clean(parsed.slidePrompts[index]) || fallbackPrompt({
            title: slide.title,
            content: slide.content || slide.introText || slide.revealText,
            keyPoints: slide.keyPoints,
            courseTitle: analysis.title,
            role: 'slide'
        });
        return {
            ...slide,
            imagePrompt: prompt,
            imagePromptProvider: parsed.slidePrompts[index] ? 'gemini' : 'local_fallback',
            imagePromptModel: parsed.slidePrompts[index] ? model : null
        };
    });

    analysis.visualPromptPlan = {
        provider: usedFallback ? 'gemini_with_fallback' : 'gemini',
        model,
        mode: 'single_batch',
        promptRequests: model ? 1 : 0,
        coverPromptReady: Boolean(analysis.coverImagePrompt),
        slidePromptsReady: analysis.slides.filter((slide) => clean(slide.imagePrompt)).length,
        totalSlides: analysis.slides.length
    };

    return analysis;
}

module.exports = {
    ensureCourseVisualPrompts,
    buildBatchInstruction,
    parseBatchText,
    fallbackPrompt,
    visualRules,
    modelCandidates,
    hasCompletePromptPlan
};
