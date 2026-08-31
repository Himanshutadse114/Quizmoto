const logger = require('../../utils/logger');
const LegacyVisual = require('./GeminiSlideVisualPromptService');
const { generateContent, responseText, vertexConfig } = require('./VertexAiClient');

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function selectedTextModel() {
    return clean(process.env.VERTEX_TEXT_MODEL || vertexConfig().textModel || 'gemini-2.5-flash');
}

function mapVertexError(error) {
    const code = String(error?.code || '');
    if (code === 'VERTEX_QUOTA') error.code = 'GEMINI_QUOTA';
    else if (code === 'VERTEX_MODEL_NOT_FOUND') error.code = 'GEMINI_MODEL_NOT_FOUND';
    else if (code === 'VERTEX_AUTH' || code === 'VERTEX_FORBIDDEN') error.code = 'GEMINI_FORBIDDEN';
    else if (code === 'VERTEX_CONFIG_MISSING') error.code = 'GEMINI_KEY_MISSING';
    else if (code === 'VERTEX_UNAVAILABLE') error.code = 'GEMINI_NETWORK';
    return error;
}

function visualInstruction(analysis) {
    // Keep the FLUX Schnell target in the instruction. Gemini writes the prompt;
    // fal.ai renders it. No Gemini Developer API key is used here.
    return LegacyVisual.batchInstruction(analysis);
}

async function requestText(instruction, maxOutputTokens = 7000, temperature = 0.18) {
    const model = selectedTextModel();
    let raw;
    try {
        raw = await generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: instruction }] }],
            generationConfig: {
                temperature,
                maxOutputTokens,
                responseMimeType: 'text/plain'
            }
        });
    } catch (error) {
        throw mapVertexError(error);
    }

    const text = responseText(raw);
    if (!text) {
        const error = new Error('Gemini returned an empty visual plan through the service-account connection.');
        error.code = 'GEMINI_VISUAL_PROMPT_EMPTY';
        throw error;
    }
    return { text, model };
}

async function generateCourseVisualPrompts(analysis) {
    const slides = Array.isArray(analysis?.slides) ? analysis.slides : [];
    if (!slides.length) return { coverPrompt: '', slidePrompts: [], model: selectedTextModel() };

    const existingCover = clean(analysis?.coverImagePrompt);
    const existingSlides = slides.map((slide) => clean(slide?.imagePrompt));
    const trustedExisting = ['gemini_service_account', 'vertex_ai'].includes(clean(analysis?.visualPromptProvider).toLowerCase());
    if (trustedExisting && existingCover && existingSlides.every(Boolean)) {
        return {
            coverPrompt: existingCover,
            slidePrompts: existingSlides,
            model: analysis?.visualPromptModel || slides.find((slide) => slide?.imagePromptModel)?.imagePromptModel || selectedTextModel(),
            cached: true
        };
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const result = await requestText(visualInstruction(analysis), 7000, 0.18);
            const parsed = LegacyVisual.parseBatchPrompts(result.text, slides.length);
            if (parsed.missing.length) {
                const error = new Error(`Gemini visual plan was incomplete: ${parsed.missing.slice(0, 4).join(', ')}`);
                error.code = 'GEMINI_VISUAL_PROMPT_INVALID';
                throw error;
            }
            return {
                coverPrompt: parsed.coverPrompt,
                slidePrompts: parsed.slidePrompts,
                model: result.model,
                cached: false
            };
        } catch (error) {
            lastError = error;
            logger.warn('scorm_service_account_visual_plan_retry', {
                module: 'scorm',
                attempt: attempt + 1,
                model: selectedTextModel(),
                code: error.code || null,
                error: error.message
            });
        }
    }
    throw lastError || new Error('Gemini could not create the complete visual plan through the service-account connection.');
}

async function generateCoverVisualPrompt(analysis) {
    const provider = clean(analysis?.coverImagePromptProvider || analysis?.visualPromptProvider).toLowerCase();
    const cached = clean(analysis?.coverImagePrompt);
    if (cached && ['gemini_service_account', 'vertex_ai'].includes(provider)) {
        return {
            prompt: cached,
            model: analysis?.coverImagePromptModel || analysis?.visualPromptModel || selectedTextModel(),
            cached: true
        };
    }

    const result = await requestText(LegacyVisual.coverInstruction(analysis), 700, 0.22);
    const prompt = LegacyVisual.enforceVisualPromptRequirements(result.text);
    if (!prompt || prompt.length < 80) {
        const error = new Error('Gemini returned an incomplete cover image prompt through the service-account connection.');
        error.code = 'GEMINI_VISUAL_PROMPT_INVALID';
        throw error;
    }
    return { prompt, model: result.model, cached: false };
}

async function generateSlideVisualPrompt(slide, analysis, slideIndex) {
    const provider = clean(slide?.imagePromptProvider || analysis?.visualPromptProvider).toLowerCase();
    const cached = clean(slide?.imagePrompt);
    if (cached && ['gemini_service_account', 'vertex_ai'].includes(provider)) {
        return {
            prompt: cached,
            model: slide?.imagePromptModel || analysis?.visualPromptModel || selectedTextModel(),
            cached: true
        };
    }

    const result = await requestText(LegacyVisual.slideInstruction(slide, analysis, slideIndex), 700, 0.22);
    const prompt = LegacyVisual.enforceVisualPromptRequirements(result.text);
    if (!prompt || prompt.length < 80) {
        const error = new Error('Gemini returned an incomplete slide image prompt through the service-account connection.');
        error.code = 'GEMINI_VISUAL_PROMPT_INVALID';
        throw error;
    }
    return { prompt, model: result.model, cached: false };
}

module.exports = {
    generateCourseVisualPrompts,
    generateCoverVisualPrompt,
    generateSlideVisualPrompt,
    selectedTextModel,
    requestText,
    visualInstruction,
    mapVertexError
};
