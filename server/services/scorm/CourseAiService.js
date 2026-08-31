const logger = require('../../utils/logger');
const GeminiPolicyAnalysisService = require('./PolicyAnalysisService');
const VertexPolicyAnalysisService = require('./VertexPolicyAnalysisService');
const GeminiVisualPromptService = require('./GeminiSlideVisualPromptService');
const VertexVisualPromptService = require('./VertexSlideVisualPromptService');
const { isVertexConfigured, vertexConfig } = require('./VertexAiClient');

function selectedProvider() {
    return isVertexConfigured() ? 'vertex_ai' : 'gemini';
}

function providerServices() {
    if (selectedProvider() === 'vertex_ai') {
        return {
            policy: VertexPolicyAnalysisService,
            visuals: VertexVisualPromptService,
            provider: 'vertex_ai'
        };
    }
    return {
        policy: GeminiPolicyAnalysisService,
        visuals: GeminiVisualPromptService,
        provider: 'gemini'
    };
}

function emit(onProgress, patch) {
    if (typeof onProgress !== 'function') return;
    try { onProgress(patch); } catch (_) {}
}

function positiveInt(value, fallback, min = 1000, max = 600000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

/**
 * Course authoring can legitimately spend tens of seconds inside one model
 * request. Keep a bounded progress heartbeat while the provider request is
 * active so a healthy Vertex/Gemini job never looks frozen to the learner.
 */
async function runWithProgressHeartbeat({
    task,
    onProgress,
    startPercent,
    maxPercent,
    stage,
    detail,
    timeoutMs,
    timeoutCode = 'GEMINI_TIMEOUT'
}) {
    let settled = false;
    let percent = Math.max(1, Number(startPercent) || 1);
    const ceiling = Math.max(percent, Number(maxPercent) || percent);
    const startedAt = Date.now();

    emit(onProgress, { percent, stage, detail });

    const heartbeat = setInterval(() => {
        if (settled) return;
        percent = Math.min(ceiling, percent + 2);
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        emit(onProgress, {
            percent,
            stage,
            detail: `${detail} Still working (${elapsedSeconds}s).`
        });
    }, 6000);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            const error = new Error('Course generation took too long while preparing the learning content. Please retry.');
            error.code = timeoutCode;
            reject(error);
        }, timeoutMs);
        if (typeof timeoutHandle.unref === 'function') timeoutHandle.unref();
    });

    try {
        return await Promise.race([Promise.resolve().then(task), timeoutPromise]);
    } finally {
        settled = true;
        clearInterval(heartbeat);
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }
}

async function analyzePolicy(args = {}) {
    const services = providerServices();
    const requested = String(process.env.SCORM_AI_PROVIDER || '').trim().toLowerCase();
    if (requested && requested !== services.provider && !(requested === 'gemini' && services.provider === 'vertex_ai')) {
        logger.info('scorm_content_provider_selected', {
            module: 'scorm',
            requestedProvider: requested,
            selectedProvider: services.provider
        });
    }

    const contentTimeoutMs = positiveInt(
        process.env.VERTEX_SCORM_CONTENT_TIMEOUT_MS || process.env.GEMINI_SCORM_CONTENT_TIMEOUT_MS,
        180000,
        30000,
        600000
    );
    const visualPlanTimeoutMs = positiveInt(
        process.env.VERTEX_SCORM_VISUAL_PLAN_TIMEOUT_MS || process.env.GEMINI_SCORM_VISUAL_PLAN_TIMEOUT_MS,
        90000,
        20000,
        300000
    );

    let analysis;
    try {
        analysis = await runWithProgressHeartbeat({
            task: () => services.policy.analyzePolicy(args),
            onProgress: args.onProgress,
            startPercent: 8,
            maxPercent: 26,
            stage: 'Creating course content',
            detail: services.provider === 'vertex_ai'
                ? 'Writing the learning structure, slide content and knowledge checks with Vertex AI.'
                : 'Writing the learning structure, slide content and knowledge checks.',
            timeoutMs: contentTimeoutMs
        });
    } catch (error) {
        logger.error('scorm_content_generation_failed', {
            module: 'scorm',
            provider: services.provider,
            error: error.message,
            code: error.code || null
        });
        throw error;
    }

    analysis.aiProvider = services.provider;
    if (services.provider === 'vertex_ai') {
        analysis.aiModel = analysis.aiModel || vertexConfig().textModel;
        analysis.aiPlatform = 'google_cloud_vertex_ai';
    }

    let visualPlan;
    try {
        visualPlan = await runWithProgressHeartbeat({
            task: () => services.visuals.generateCourseVisualPrompts(analysis),
            onProgress: args.onProgress,
            startPercent: 28,
            maxPercent: 34,
            stage: 'Planning course visuals',
            detail: services.provider === 'vertex_ai'
                ? 'Preparing slide-specific visual directions with Vertex AI.'
                : 'Preparing slide-specific visual directions for the course.',
            timeoutMs: visualPlanTimeoutMs,
            timeoutCode: 'GEMINI_VISUAL_PLAN_TIMEOUT'
        });
    } catch (error) {
        logger.error('scorm_visual_plan_generation_failed', {
            module: 'scorm',
            provider: services.provider,
            error: error.message,
            code: error.code || null
        });
        throw error;
    }

    analysis = {
        ...analysis,
        coverImagePrompt: visualPlan.coverPrompt,
        coverImagePromptProvider: services.provider,
        coverImagePromptModel: visualPlan.model,
        visualPromptProvider: services.provider,
        visualPromptModel: visualPlan.model,
        visualPromptsReady: true,
        slides: (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide, index) => ({
            ...(slide || {}),
            imagePrompt: visualPlan.slidePrompts[index] || '',
            imagePromptProvider: services.provider,
            imagePromptModel: visualPlan.model
        }))
    };

    emit(args.onProgress, {
        percent: 36,
        stage: 'Course content ready',
        detail: 'Course text, knowledge checks and slide visual directions are ready.',
        modelStatus: 'succeeded'
    });

    logger.info('scorm_content_and_visual_plan_ready', {
        module: 'scorm',
        provider: services.provider,
        textModel: analysis.aiModel || null,
        slides: Array.isArray(analysis.slides) ? analysis.slides.length : 0,
        quiz: Array.isArray(analysis.quiz) ? analysis.quiz.length : 0,
        visualPromptModel: visualPlan.model,
        visualPrompts: visualPlan.slidePrompts.length + (visualPlan.coverPrompt ? 1 : 0)
    });

    return analysis;
}

module.exports = {
    analyzePolicy,
    selectedProvider,
    providerServices,
    runWithProgressHeartbeat,
    positiveInt
};
