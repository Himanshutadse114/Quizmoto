const logger = require('../../utils/logger');
const GeminiPolicyAnalysisService = require('./PolicyAnalysisService');
const { ensureCourseVisualPrompts } = require('./GeminiCourseVisualPromptBatchService');

/**
 * SCORM authoring uses a deliberately hybrid provider strategy:
 * - Gemini writes and quality-refines all course content and knowledge checks.
 * - Gemini also plans the cover + every slide image prompt in one batch request.
 * - Replicate/FLUX Schnell is reserved for raster rendering during packaging.
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
        detail: 'Gemini is extracting the learning content, slide structure and knowledge checks.'
    });

    let analysis = await GeminiPolicyAnalysisService.analyzePolicy(args);
    analysis.aiProvider = 'gemini';

    emit(args.onProgress, {
        percent: 88,
        stage: 'Planning all course images with Gemini',
        detail: 'Gemini is creating the cover prompt and every slide prompt together in one batch from the completed course data.'
    });

    analysis = await ensureCourseVisualPrompts(analysis);
    analysis.aiProvider = 'gemini';

    emit(args.onProgress, {
        percent: 94,
        stage: 'Course data and image prompts ready',
        detail: 'The learner content and all slide-specific image prompts are ready. FLUX Schnell only needs to render the selected images.',
        modelStatus: 'succeeded'
    });

    logger.info('scorm_gemini_content_and_visual_plan_ready', {
        module: 'scorm',
        slides: Array.isArray(analysis.slides) ? analysis.slides.length : 0,
        quiz: Array.isArray(analysis.quiz) ? analysis.quiz.length : 0,
        visualPromptMode: analysis.visualPromptPlan?.mode || null,
        slidePromptsReady: analysis.visualPromptPlan?.slidePromptsReady || 0
    });

    return analysis;
}

module.exports = {
    analyzePolicy,
    selectedProvider
};
