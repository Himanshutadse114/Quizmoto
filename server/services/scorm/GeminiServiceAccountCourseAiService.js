const logger = require('../../utils/logger');
const PolicyService = require('./VertexPolicyAnalysisService');
const VisualPromptService = require('./GeminiServiceAccountVisualPromptService');
const { vertexConfig } = require('./VertexAiClient');

function clean(value) {
    return String(value || '').trim();
}

function serviceAccountConfigured() {
    const projectId = clean(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
    const credentialFile = clean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    return Boolean(projectId && credentialFile);
}

function selectedProvider() {
    return serviceAccountConfigured() ? 'vertex_ai' : 'unconfigured';
}

function providerServices() {
    if (!serviceAccountConfigured()) {
        const error = new Error('Gemini course generation requires the Google service account. Configure GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT on the backend.');
        // Keep an existing route-recognised code so the API returns 503 rather than 500.
        error.code = 'GEMINI_KEY_MISSING';
        throw error;
    }
    return {
        policy: PolicyService,
        visuals: VisualPromptService,
        provider: 'vertex_ai',
        auth: 'service_account'
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
            detail: 'Gemini is writing the learning structure, slide content and knowledge checks through the Google service account.',
            timeoutMs: contentTimeoutMs
        });
    } catch (error) {
        logger.error('scorm_service_account_content_generation_failed', {
            module: 'scorm',
            provider: services.provider,
            auth: services.auth,
            error: error.message,
            code: error.code || null
        });
        throw error;
    }

    analysis.aiProvider = 'vertex_ai';
    analysis.aiAuth = 'service_account';
    analysis.aiModel = analysis.aiModel || vertexConfig().textModel;
    analysis.aiPlatform = 'google_cloud_vertex_ai';

    let visualPlan;
    try {
        visualPlan = await runWithProgressHeartbeat({
            task: () => services.visuals.generateCourseVisualPrompts(analysis),
            onProgress: args.onProgress,
            startPercent: 28,
            maxPercent: 34,
            stage: 'Planning course visuals',
            detail: 'Gemini is preparing FLUX Schnell prompts through the Google service account.',
            timeoutMs: visualPlanTimeoutMs,
            timeoutCode: 'GEMINI_VISUAL_PLAN_TIMEOUT'
        });
    } catch (error) {
        logger.error('scorm_service_account_visual_plan_generation_failed', {
            module: 'scorm',
            provider: services.provider,
            auth: services.auth,
            error: error.message,
            code: error.code || null
        });
        throw error;
    }

    analysis = {
        ...analysis,
        coverImagePrompt: visualPlan.coverPrompt,
        coverImagePromptProvider: 'gemini_service_account',
        coverImagePromptModel: visualPlan.model,
        visualPromptProvider: 'gemini_service_account',
        visualPromptModel: visualPlan.model,
        visualPromptsReady: true,
        slides: (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide, index) => ({
            ...(slide || {}),
            imagePrompt: visualPlan.slidePrompts[index] || '',
            imagePromptProvider: 'gemini_service_account',
            imagePromptModel: visualPlan.model
        }))
    };

    emit(args.onProgress, {
        percent: 36,
        stage: 'Course content ready',
        detail: 'Course text, knowledge checks and FLUX Schnell image prompts are ready.',
        modelStatus: 'succeeded'
    });

    logger.info('scorm_service_account_content_and_visual_plan_ready', {
        module: 'scorm',
        provider: services.provider,
        auth: services.auth,
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
    serviceAccountConfigured,
    runWithProgressHeartbeat,
    positiveInt
};
