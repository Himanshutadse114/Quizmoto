const logger = require('../../utils/logger');
const LegacyVisual = require('./GeminiSlideVisualPromptService');
const { generateContent, responseText, vertexConfig } = require('./VertexAiClient');

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function selectedTextModel() {
    return clean(process.env.VERTEX_TEXT_MODEL || vertexConfig().textModel || 'gemini-2.5-flash');
}

function vertexVisualInstruction(analysis) {
    return LegacyVisual.batchInstruction(analysis)
        .replace(/FLUX Schnell/gi, 'the configured Google Vertex AI image model')
        .replace(/FLUX/gi, 'the image model');
}

async function requestText(instruction, maxOutputTokens = 7000, temperature = 0.18) {
    const model = selectedTextModel();
    const raw = await generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: 'text/plain'
        }
    });
    const text = responseText(raw);
    if (!text) {
        const error = new Error('Vertex AI returned an empty visual plan.');
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
    if (existingCover && existingSlides.every(Boolean)) {
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
            const result = await requestText(vertexVisualInstruction(analysis), 7000, 0.18);
            const parsed = LegacyVisual.parseBatchPrompts(result.text, slides.length);
            if (parsed.missing.length) {
                const error = new Error(`Vertex AI visual plan was incomplete: ${parsed.missing.slice(0, 4).join(', ')}`);
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
            logger.warn('scorm_vertex_visual_plan_retry', {
                module: 'scorm',
                attempt: attempt + 1,
                model: selectedTextModel(),
                code: error.code || null,
                error: error.message
            });
        }
    }
    throw lastError || new Error('Vertex AI could not create the complete course visual plan.');
}

async function generateCoverVisualPrompt(analysis) {
    const cached = clean(analysis?.coverImagePrompt);
    if (cached) {
        return {
            prompt: cached,
            model: analysis?.coverImagePromptModel || analysis?.visualPromptModel || selectedTextModel(),
            cached: true
        };
    }
    const result = await requestText(
        LegacyVisual.coverInstruction(analysis).replace(/FLUX/gi, 'the image model'),
        700,
        0.22
    );
    const prompt = LegacyVisual.enforceVisualPromptRequirements(result.text);
    if (!prompt || prompt.length < 80) {
        const error = new Error('Vertex AI returned an incomplete cover image prompt.');
        error.code = 'GEMINI_VISUAL_PROMPT_INVALID';
        throw error;
    }
    return { prompt, model: result.model, cached: false };
}

async function generateSlideVisualPrompt(slide, analysis, slideIndex) {
    const cached = clean(slide?.imagePrompt);
    if (cached) {
        return {
            prompt: cached,
            model: slide?.imagePromptModel || analysis?.visualPromptModel || selectedTextModel(),
            cached: true
        };
    }
    const result = await requestText(
        LegacyVisual.slideInstruction(slide, analysis, slideIndex).replace(/FLUX/gi, 'the image model'),
        700,
        0.22
    );
    const prompt = LegacyVisual.enforceVisualPromptRequirements(result.text);
    if (!prompt || prompt.length < 80) {
        const error = new Error('Vertex AI returned an incomplete slide image prompt.');
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
    requestText
};
