// Compatibility entry point retained for existing SCORM routes and tests.
// Course generation uses OpenAI with the configured server-side API key.
// Keep the provider call behind a bounded progress wrapper: a model request can
// legitimately take a while, but it must never leave a course frozen at 2%.
const logger = require('../../utils/logger');
const PolicyAnalysisService = require('./PolicyAnalysisService');

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
    timeoutCode = 'OPENAI_TIMEOUT'
}) {
    let settled = false;
    let percent = Math.max(1, Number(startPercent) || 1);
    const ceiling = Math.max(percent, Number(maxPercent) || percent);
    const startedAt = Date.now();

    emit(onProgress, { percent, stage, detail, modelStatus: 'running' });

    const heartbeat = setInterval(() => {
        if (settled) return;
        percent = Math.min(ceiling, percent + 2);
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        emit(onProgress, {
            percent,
            stage,
            detail: `${detail} Still working (${elapsedSeconds}s).`,
            modelStatus: 'running'
        });
    }, 6000);
    heartbeat.unref?.();

    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            const error = new Error('Course creation took longer than expected while preparing the learning content. Please retry.');
            error.code = timeoutCode;
            reject(error);
        }, timeoutMs);
        timeoutHandle.unref?.();
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
    const contentTimeoutMs = positiveInt(
        process.env.OPENAI_SCORM_CONTENT_TIMEOUT_MS,
        90000,
        30000,
        600000
    );

    try {
        const analysis = await runWithProgressHeartbeat({
            task: () => PolicyAnalysisService.analyzePolicy(args),
            onProgress: args.onProgress,
            startPercent: 4,
            maxPercent: 24,
            stage: 'Creating course content',
            detail: 'Organising the source into clear learning sections and knowledge checks.',
            timeoutMs: contentTimeoutMs
        });
        analysis.aiProvider = analysis.aiProvider || 'openai';
        emit(args.onProgress, {
            percent: 26,
            stage: 'Course content ready',
            detail: 'The learning sections and knowledge checks are ready.',
            modelStatus: 'succeeded'
        });
        return analysis;
    } catch (error) {
        logger.error('scorm_content_generation_failed', {
            module: 'scorm',
            error: error.message,
            code: error.code || null
        });
        throw error;
    }
}

module.exports = {
    analyzePolicy,
    runWithProgressHeartbeat,
    positiveInt
};
