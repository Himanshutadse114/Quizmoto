const logger = require('../../utils/logger');
const GeminiPolicyAnalysisService = require('./PolicyAnalysisService');
const { generateCourseVisualPrompts } = require('./GeminiSlideVisualPromptService');

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
        stage: 'Creating complete course plan with Gemini',
        detail: 'Gemini is extracting the source, writing the course, knowledge checks and the complete visual plan before the editor opens.'
    });

    let analysis = await GeminiPolicyAnalysisService.analyzePolicy(args);
    analysis.aiProvider = 'gemini';

    emit(args.onProgress, {
        percent: 88,
        stage: 'Planning all course images with Gemini',
        detail: 'Gemini is creating the cover prompt and every slide image prompt together in one visual-planning request.'
    });

    const visualPlan = await generateCourseVisualPrompts(analysis);
    analysis = {
        ...analysis,
        coverImagePrompt: visualPlan.coverPrompt,
        coverImagePromptProvider: 'gemini',
        coverImagePromptModel: visualPlan.model,
        visualPromptProvider: 'gemini',
        visualPromptModel: visualPlan.model,
        visualPromptsReady: true,
        slides: (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide, index) => ({
            ...(slide || {}),
            imagePrompt: visualPlan.slidePrompts[index] || '',
            imagePromptProvider: 'gemini',
            imagePromptModel: visualPlan.model
        }))
    };

    emit(args.onProgress, {
        percent: 96,
        stage: 'Course content and visual plan ready',
        detail: 'Course text, quizzes and all slide-specific image prompts are ready. Generate course will only render the pre-planned images with FLUX Schnell and package the SCORM.',
        modelStatus: 'succeeded'
    });

    logger.info('scorm_gemini_content_and_visual_plan_ready', {
        module: 'scorm',
        slides: Array.isArray(analysis.slides) ? analysis.slides.length : 0,
        quiz: Array.isArray(analysis.quiz) ? analysis.quiz.length : 0,
        visualPromptModel: visualPlan.model,
        visualPrompts: visualPlan.slidePrompts.length + (visualPlan.coverPrompt ? 1 : 0)
    });

    return analysis;
}

module.exports = {
    analyzePolicy,
    selectedProvider
};
