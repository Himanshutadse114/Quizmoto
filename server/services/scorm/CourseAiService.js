const logger = require('../../utils/logger');
const GeminiPolicyAnalysisService = require('./PolicyAnalysisService');

/**
 * SCORM authoring uses a deliberately hybrid provider strategy:
 * - Gemini writes and quality-refines all course content and knowledge checks.
 * - Replicate is reserved for raster image generation during final packaging.
 *
 * Keep this decision server-side so an old SCORM_AI_PROVIDER=replicate Render
 * variable cannot accidentally route long-form course writing back through a
 * slow/cold-starting Replicate text model.
 */
function selectedProvider() {
    return 'gemini';
}

function emit(onProgress, patch) {
    if (typeof onProgress !== 'function') return;
    try { onProgress(patch); } catch (_) {}
}

async function analyzePolicy(args = {}) {
    const requested = String(process.env.SCORM_AI_PROVIDER || '').trim().toLowerCase();
    if (requested && requested !== 'gemini') {
        logger.info('scorm_content_provider_forced_gemini', {
            module: 'scorm',
            requestedProvider: requested,
            reason: 'Replicate is image-only for SCORM authoring'
        });
    }

    emit(args.onProgress, {
        percent: 8,
        stage: 'Creating course content with Gemini',
        detail: 'Gemini is writing the lessons, slide structure and knowledge checks. Replicate is not used for course text.'
    });

    const analysis = await GeminiPolicyAnalysisService.analyzePolicy(args);
    analysis.aiProvider = 'gemini';

    emit(args.onProgress, {
        percent: 94,
        stage: 'Gemini course content ready',
        detail: 'The course draft and quiz are ready. Final raster images will be generated with Replicate only after you click Generate course.',
        modelStatus: 'succeeded'
    });

    logger.info('scorm_gemini_content_ready', {
        module: 'scorm',
        slides: Array.isArray(analysis.slides) ? analysis.slides.length : 0,
        quiz: Array.isArray(analysis.quiz) ? analysis.quiz.length : 0
    });

    return analysis;
}

module.exports = {
    analyzePolicy,
    selectedProvider
};
