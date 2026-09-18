const logger = require('../../utils/logger');
const {
    generateCoverVisualPrompt,
    generateSlideVisualPrompt
} = require('./OpenAiSlideVisualPromptService');
const {
    coverInstruction,
    slideInstruction,
    sharedVisualRules
} = require('./OpenAiSlideVisualPromptService');
const { optimizeCourseMedia } = require('./ScormImageOptimizationService');
const {
    getApiKey: getOpenAiApiKey,
    generateImage: requestOpenAiGeneratedImage,
    DEFAULT_IMAGE_MODEL,
    DEFAULT_TEXT_MODEL,
    LOW_IMAGE_ESTIMATE_USD,
    textModel
} = require('../openai/OpenAiClient');

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getApiKey() {
    return getOpenAiApiKey();
}

function mediaConfig() {
    return {
        enabled: String(process.env.OPENAI_SCORM_MEDIA || 'true').trim().toLowerCase() !== 'false',
        imageModel: clean(process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL),
        maxImages: clampInt(process.env.OPENAI_SCORM_MAX_IMAGES, 5, 1, 6),
        minImages: clampInt(process.env.OPENAI_SCORM_MIN_IMAGES, 5, 1, 6),
        imageRetries: clampInt(process.env.OPENAI_SCORM_IMAGE_RETRIES, 0, 0, 1),
        imageConcurrency: clampInt(process.env.OPENAI_SCORM_IMAGE_CONCURRENCY, 5, 1, 5),
        timeoutMs: clampInt(process.env.OPENAI_SCORM_IMAGE_TIMEOUT_MS, 55000, 30000, 90000),
        mediaDeadlineMs: clampInt(process.env.OPENAI_SCORM_MEDIA_DEADLINE_MS, 80000, 45000, 120000),
        retryBaseMs: clampInt(process.env.OPENAI_SCORM_IMAGE_RETRY_BASE_MS, 1800, 500, 5000),
        budgetInr: clampInt(process.env.OPENAI_COURSE_BUDGET_INR, 10, 5, 25),
        usdToInr: clampInt(process.env.OPENAI_USD_TO_INR, 95, 80, 120)
    };
}

function isGenerationCancelled(error) {
    return String(error?.code || '') === 'SCORM_GENERATION_CANCELLED';
}

function emit(onProgress, patch) {
    if (typeof onProgress !== 'function') return;
    try {
        onProgress(patch);
    } catch (error) {
        if (isGenerationCancelled(error)) throw error;
    }
}

async function runWithConcurrency(items, concurrency, worker) {
    const queue = Array.isArray(items) ? items : [];
    if (!queue.length) return;
    let cursor = 0;
    const workerCount = Math.min(queue.length, Math.max(1, Number(concurrency) || 1));
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (true) {
            const position = cursor;
            cursor += 1;
            if (position >= queue.length) return;
            await worker(queue[position], position);
        }
    }));
}

function imageSlideIndexes(slides, count) {
    const total = Array.isArray(slides) ? slides.length : 0;
    if (!total || count <= 0) return [];
    if (count >= total) return Array.from({ length: total }, (_, index) => index);
    const chosen = new Set();
    for (let slot = 0; slot < count; slot += 1) {
        const index = count === 1 ? Math.floor(total / 2) : Math.round((slot * (total - 1)) / (count - 1));
        chosen.add(index);
    }
    for (let index = 0; chosen.size < count && index < total; index += 1) chosen.add(index);
    return Array.from(chosen).sort((a, b) => a - b);
}

function sentenceExcerpt(value, maxChars) {
    const text = clean(value);
    if (!text || maxChars <= 0) return '';
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars).replace(/\s+\S*$/, '').replace(/[,:;\-]+$/, '').trim()}…`;
}

function isHighlyInteractiveAnalysis(analysis) {
    return clean(analysis?.templateBinding?.templateId).toLowerCase() === 'highly-interactive';
}

function highlyInteractiveTopicPrompt(prompt, slide, analysis) {
    const base = clean(prompt);
    if (!base || !isHighlyInteractiveAnalysis(analysis)) return base;
    const title = clean(slide?.title) || 'this exact lesson';
    const keyIdeas = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : [])
        .map((point) => sentenceExcerpt(point, 130))
        .filter(Boolean)
        .slice(0, 3);
    const lesson = sentenceExcerpt(slide?.content || slide?.introText || slide?.revealText, 240);
    const anchors = keyIdeas.length ? keyIdeas.join('; ') : lesson;
    return clean([
        base,
        `TOPIC FIDELITY: the scene must unmistakably communicate the lesson concept ${title}.`,
        anchors ? `Use concrete objects, setting and visual relationships grounded in these lesson details: ${anchors}.` : '',
        'Do not substitute a generic decorative, abstract or unrelated illustration.'
    ].filter(Boolean).join(' '));
}

function anchorHighlyInteractivePrompt(promptInfo, slide, analysis) {
    if (!promptInfo || typeof promptInfo !== 'object') return promptInfo;
    return {
        ...promptInfo,
        prompt: highlyInteractiveTopicPrompt(promptInfo.prompt, slide, analysis)
    };
}

function highlyInteractiveCoverPrompt(prompt, analysis) {
    const base = clean(prompt);
    if (!base || !isHighlyInteractiveAnalysis(analysis)) return base;

    const courseTitle = clean(analysis?.title) || 'this course';
    const summary = sentenceExcerpt(analysis?.summary, 320);
    const coreLessons = (Array.isArray(analysis?.slides) ? analysis.slides : [])
        .slice(0, 4)
        .map((slide) => {
            const title = sentenceExcerpt(slide?.title, 100);
            const point = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : [])
                .map((value) => sentenceExcerpt(value, 100))
                .find(Boolean);
            return [title, point].filter(Boolean).join(': ');
        })
        .filter(Boolean);

    return clean([
        base,
        `INTERACTIVE COVER FIDELITY: create a strong opening visual that unmistakably represents the complete course subject ${courseTitle}.`,
        summary ? `Course meaning to express visually: ${summary}.` : '',
        coreLessons.length ? `Ground the hero scene in these actual course concepts: ${coreLessons.join('; ')}.` : '',
        'Choose one recognisable topic-specific hero scene with concrete objects and meaningful relationships. The image must preview what the learner will study, not merely create atmosphere.',
        'Reject generic abstract shapes, random technology, decorative office scenes and unrelated cybersecurity symbols unless those exact concepts belong to this course.',
        'Keep the image non-human and completely free of text, letters, numbers, logos and watermarks.'
    ].filter(Boolean).join(' '));
}

function anchorHighlyInteractiveCoverPrompt(promptInfo, analysis) {
    if (!promptInfo || typeof promptInfo !== 'object') return promptInfo;
    return {
        ...promptInfo,
        prompt: highlyInteractiveCoverPrompt(promptInfo.prompt, analysis)
    };
}

function warningSummary(warnings, max = 3) {
    const unique = [];
    for (const warning of warnings || []) {
        const value = clean(warning);
        if (!value || unique.includes(value)) continue;
        unique.push(value);
        if (unique.length >= max) break;
    }
    return unique.join(' | ');
}

function clearLegacyVisuals(slide) {
    const next = { ...(slide || {}) };
    delete next.narrationAsset;
    delete next.narrationText;
    delete next.rasterVisualAsset;
    delete next.visualAsset;
    delete next.mobileVisualAsset;
    delete next.visualSource;
    delete next.visualAssetType;
    return next;
}

function mimeExtension(contentType) {
    const type = String(contentType || '').toLowerCase();
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
    if (type.includes('webp')) return 'webp';
    return 'png';
}

function assignRasterVisual(slide, path, promptInfo, contentType = 'image/png') {
    slide.rasterVisualAsset = path;
    slide.visualAsset = path;
    slide.mobileVisualAsset = path;
    slide.visualSource = 'ai_raster';
    slide.visualAssetType = contentType;
    slide.imagePrompt = promptInfo.prompt;
    slide.imagePromptProvider = 'openai';
    slide.imagePromptAuth = 'server_api_key';
    slide.imagePromptModel = promptInfo.model || 'deterministic-course-grounded-v1';
    return slide;
}

function imageError(message, code, status = 0, body = '') {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    error.body = body;
    return error;
}

function isRetryableImageError(error) {
    const status = Number(error?.status || 0);
    return status === 429 || status >= 500 || [
        'OPENAI_NETWORK',
        'OPENAI_IMAGE_TIMEOUT',
        'OPENAI_IMAGE_EMPTY',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND'
    ].includes(String(error?.code || ''));
}

function retryDelayMs(error, attempt, config) {
    const base = Number(error?.status || 0) === 429 ? Math.max(3000, config.retryBaseMs * 2) : config.retryBaseMs;
    return Math.min(30000, base * Math.pow(2, Math.max(0, attempt)));
}

async function requestOpenAiImage(_apiKey, model, prompt, config) {
    return requestOpenAiGeneratedImage({
        model,
        prompt,
        quality: 'low',
        size: '1536x864',
        timeoutMs: config.timeoutMs
    });
}

async function generateImage(prompt, pathStem, config, onStatus, checkCancelled = null) {
    const apiKey = getApiKey();
    if (!apiKey) throw imageError('OPENAI_API_KEY is not configured on the server.', 'OPENAI_KEY_MISSING');

    const preferredModel = config.imageModel || DEFAULT_IMAGE_MODEL;
    const models = [preferredModel, DEFAULT_IMAGE_MODEL].filter((model, index, all) => model && all.indexOf(model) === index);
    let lastError = null;

    for (const model of models) {
        for (let attempt = 0; attempt <= config.imageRetries; attempt += 1) {
            let progressHeartbeat = null;
            try {
                if (typeof checkCancelled === 'function') checkCancelled();
                if (typeof onStatus === 'function') onStatus({ status: attempt ? 'retrying' : 'starting', attempt: attempt + 1, model });
                const requestStartedAt = Date.now();
                progressHeartbeat = setInterval(() => {
                    if (typeof onStatus !== 'function') return;
                    onStatus({
                        status: 'working',
                        attempt: attempt + 1,
                        model,
                        elapsedSeconds: Math.max(1, Math.round((Date.now() - requestStartedAt) / 1000))
                    });
                }, 8000);
                progressHeartbeat.unref?.();
                const generated = await requestOpenAiImage(apiKey, model, prompt, config);
                if (typeof checkCancelled === 'function') checkCancelled();
                const extension = mimeExtension(generated.contentType);
                return {
                    path: `${pathStem}.${extension}`,
                    body: generated.body,
                    contentType: generated.contentType,
                    model
                };
            } catch (error) {
                if (isGenerationCancelled(error)) throw error;
                lastError = error;
                if (Number(error?.status || 0) === 404) break;
                if (attempt >= config.imageRetries || !isRetryableImageError(error)) break;
                const delayMs = retryDelayMs(error, attempt, config);
                logger.warn('scorm_openai_image_retry', {
                    module: 'scorm',
                    model,
                    attempt: attempt + 1,
                    nextAttempt: attempt + 2,
                    delayMs,
                    code: error.code || null,
                    status: error.status || null,
                    error: error.message
                });
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            } finally {
                if (progressHeartbeat) clearInterval(progressHeartbeat);
            }
        }
    }
    throw lastError || imageError('OpenAI image generation failed.', 'OPENAI_IMAGE_API_ERROR');
}

async function prepareOpenAiCourseMedia(rawAnalysis, opts = {}) {
    const onProgress = opts.onProgress;
    const checkCancelled = typeof opts.checkCancelled === 'function' ? opts.checkCancelled : () => {};
    checkCancelled();

    const config = mediaConfig();
    const mediaDeadlineAt = Date.now() + config.mediaDeadlineMs;
    const key = getApiKey();
    if (!config.enabled || !key) {
        emit(onProgress, {
            percent: 42,
            stage: 'Image generation unavailable',
            detail: 'Course visuals are temporarily unavailable.'
        });
        const error = new Error('OpenAI image generation is required. Configure OPENAI_API_KEY and keep OPENAI_SCORM_MEDIA enabled.');
        error.code = 'OPENAI_KEY_MISSING';
        throw error;
    }

    const source = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    const slides = (Array.isArray(source.slides) ? source.slides : []).map(clearLegacyVisuals);
    let analysis = { ...source, slides };
    delete analysis.narrationAsset;
    delete analysis.narrationText;
    delete analysis.coverImageAsset;
    delete analysis.coverVisualAsset;
    delete analysis.coverMobileVisualAsset;

    analysis.visualMode = 'raster';
    analysis.visualProvider = 'openai';
    analysis.visualPromptProvider = 'deterministic_course_grounded';

    const textCostUsd = Math.max(0, Number(analysis.aiEstimatedCostUsd) || 0);
    const courseBudgetUsd = config.budgetInr / config.usdToInr;
    const imageBudgetUsd = Math.max(LOW_IMAGE_ESTIMATE_USD, courseBudgetUsd - textCostUsd - 0.012);
    const affordableImages = Math.max(1, Math.floor(imageBudgetUsd / LOW_IMAGE_ESTIMATE_USD));
    config.maxImages = Math.min(config.maxImages, affordableImages);
    config.minImages = Math.min(config.minImages, config.maxImages);

    const selectedIndexes = imageSlideIndexes(
        slides,
        Math.min(Math.max(0, config.maxImages - 1), slides.length)
    );
    const availableImageSlots = 1 + selectedIndexes.length;
    const requiredImages = Math.min(availableImageSlots, config.maxImages, config.minImages);
    const requiredSlideImages = Math.max(0, requiredImages - 1);
    let files = [];
    const warnings = [];
    const successfulSlideIndexes = new Set();
    let coverGenerated = false;
    let slideImagesGenerated = 0;
    let promptModel = null;
    let imageModel = config.imageModel;

    emit(onProgress, {
        percent: 28,
        stage: 'Planning course visuals',
        detail: 'Planning a relevant visual for each learning section.'
    });

    // Start the cover and learning-slide pipelines together. The cover used to
    // block every slide image, adding an entire image-generation round trip to
    // each course even though the work is independent.
    const coverTask = (async () => {
        try {
            checkCancelled();
            const coverPrompt = anchorHighlyInteractiveCoverPrompt(
                await generateCoverVisualPrompt({ ...analysis, slides }),
                { ...analysis, slides }
            );
            promptModel = coverPrompt.model || promptModel;
            analysis.coverImagePrompt = coverPrompt.prompt;
            analysis.coverImagePromptProvider = 'openai';
            analysis.coverImagePromptAuth = 'server_api_key';
            analysis.coverImagePromptModel = coverPrompt.model;

            const coverFile = await generateImage(coverPrompt.prompt, 'assets/media/course-cover', config, (state) => {
                if (state.status === 'starting') emit(onProgress, {
                    percent: 30,
                    stage: 'Generating course cover image',
                    detail: 'Creating the course cover visual.'
                });
                if (state.status === 'working') emit(onProgress, {
                    percent: Math.min(37, 30 + Math.floor(Number(state.elapsedSeconds || 0) / 20)),
                    stage: 'Generating course cover image',
                    detail: `Creating the topic-specific course cover (${Number(state.elapsedSeconds || 0)}s).`
                });
                if (state.status === 'retrying') emit(onProgress, {
                    percent: 36,
                    stage: 'Retrying course cover image',
                    detail: 'The cover is taking a little longer. Trying again.'
                });
            }, checkCancelled);
            imageModel = coverFile.model || imageModel;
            files.push(coverFile);
            analysis.coverImageAsset = coverFile.path;
            analysis.coverVisualAsset = coverFile.path;
            analysis.coverMobileVisualAsset = coverFile.path;
            coverGenerated = true;
            emit(onProgress, {
                percent: 38,
                stage: 'Course cover ready',
                detail: 'The topic-specific course cover is ready.'
            });
        } catch (error) {
            if (isGenerationCancelled(error)) throw error;
            warnings.push(`Cover image: ${error.message}`);
            logger.warn('scorm_openai_course_cover_failed', {
                module: 'scorm',
                code: error.code || null,
                status: error.status || null,
                error: error.message
            });
        }
    })();

    let completedJobs = 0;
    const slideTask = runWithConcurrency(selectedIndexes, config.imageConcurrency, async (slideIndex, jobPosition) => {
        checkCancelled();
        const startedAtCompleted = completedJobs;
        const basePercent = 40 + Math.round((startedAtCompleted / Math.max(1, selectedIndexes.length)) * 30);
        try {
            emit(onProgress, {
                percent: basePercent,
                stage: `Planning slide ${slideIndex + 1} visual`,
                detail: `Preparing visual ${jobPosition + 1} of ${selectedIndexes.length}.`
            });
            const promptInfo = anchorHighlyInteractivePrompt(
                await generateSlideVisualPrompt(slides[slideIndex], { ...analysis, slides }, slideIndex),
                slides[slideIndex],
                analysis
            );
            promptModel = promptModel || promptInfo.model;
            const file = await generateImage(
                promptInfo.prompt,
                `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}`,
                config,
                (state) => {
                    if (state.status === 'starting') emit(onProgress, {
                        percent: Math.min(71, basePercent + 1),
                        stage: `Generating slide ${slideIndex + 1} image`,
                        detail: 'Creating a visual for this learning section.'
                    });
                    if (state.status === 'working') emit(onProgress, {
                        percent: Math.min(71, basePercent + Math.min(3, Math.floor(Number(state.elapsedSeconds || 0) / 24))),
                        stage: `Generating slide ${slideIndex + 1} image`,
                        detail: `Creating a topic-specific learning visual (${Number(state.elapsedSeconds || 0)}s).`
                    });
                    if (state.status === 'retrying') emit(onProgress, {
                        percent: Math.min(71, basePercent + 2),
                        stage: `Retrying slide ${slideIndex + 1} image`,
                        detail: 'This visual is taking a little longer. Trying again.'
                    });
                },
                checkCancelled
            );
            imageModel = file.model || imageModel;
            files.push(file);
            assignRasterVisual(slides[slideIndex], file.path, promptInfo, file.contentType);
            successfulSlideIndexes.add(slideIndex);
            slideImagesGenerated += 1;
        } catch (error) {
            if (isGenerationCancelled(error)) throw error;
            warnings.push(`Slide ${slideIndex + 1} image: ${error.message}`);
            logger.warn('scorm_openai_slide_image_failed', {
                module: 'scorm',
                slideIndex,
                code: error.code || null,
                status: error.status || null,
                error: error.message
            });
        } finally {
            completedJobs += 1;
            emit(onProgress, {
                percent: 42 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 30),
                stage: 'Generating learning-slide images',
                detail: `${completedJobs} of ${selectedIndexes.length} course visuals completed.`
            });
        }
    });
    await Promise.all([coverTask, slideTask]);

    if (coverGenerated && slideImagesGenerated < requiredSlideImages) {
        const recoveryCandidates = [
            ...selectedIndexes.filter((index) => !successfulSlideIndexes.has(index)),
            ...slides.map((_, index) => index).filter((index) => !successfulSlideIndexes.has(index) && !selectedIndexes.includes(index))
        ];
        for (const slideIndex of recoveryCandidates) {
            checkCancelled();
            const remainingMs = mediaDeadlineAt - Date.now();
            if (remainingMs < 30000) break;
            if (slideImagesGenerated >= requiredSlideImages) break;
            try {
                const promptInfo = anchorHighlyInteractivePrompt(
                    await generateSlideVisualPrompt(slides[slideIndex], { ...analysis, slides }, slideIndex),
                    slides[slideIndex],
                    analysis
                );
                const file = await generateImage(
                    promptInfo.prompt,
                    `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}`,
                    { ...config, timeoutMs: Math.min(config.timeoutMs, remainingMs) },
                    null,
                    checkCancelled
                );
                files.push(file);
                assignRasterVisual(slides[slideIndex], file.path, promptInfo, file.contentType);
                successfulSlideIndexes.add(slideIndex);
                slideImagesGenerated += 1;
            } catch (error) {
                if (isGenerationCancelled(error)) throw error;
                warnings.push(`Recovery slide ${slideIndex + 1}: ${error.message}`);
            }
        }
    }

    checkCancelled();
    if (!coverGenerated || slideImagesGenerated < requiredSlideImages) {
        const totalGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
        const reason = warningSummary(warnings);
        const error = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required.${reason ? ` OpenAI reported: ${reason}` : ''}`);
        error.code = 'OPENAI_IMAGES_INCOMPLETE';
        error.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: error.message });
        throw error;
    }

    emit(onProgress, {
        percent: 74,
        stage: 'Optimising course images',
        detail: 'Optimising every visual for consistent, fast loading.'
    });
    const optimizedMedia = await optimizeCourseMedia(analysis, files);
    analysis = optimizedMedia.analysis;
    files = optimizedMedia.files;

    const totalImagesGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
    const mediaMetadata = {
        provider: 'openai',
        auth: 'server_api_key',
        textModel: textModel() || DEFAULT_TEXT_MODEL,
        imageModel,
        visualPromptProvider: 'deterministic_course_grounded',
        visualPromptModel: promptModel,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        maxImages: config.maxImages,
        minImages: requiredImages,
        imageConcurrency: config.imageConcurrency,
        selectedSlideIndexes: selectedIndexes,
        successfulSlideIndexes: Array.from(successfulSlideIndexes).sort((a, b) => a - b),
        imageStyle: 'openai_generated_16_9_non_human_no_text',
        quality: 'low',
        budgetInr: config.budgetInr,
        usdToInr: config.usdToInr,
        estimatedTextCostUsd: textCostUsd,
        estimatedImageCostUsd: totalImagesGenerated * LOW_IMAGE_ESTIMATE_USD,
        estimatedTotalCostInr: Math.round((textCostUsd + totalImagesGenerated * LOW_IMAGE_ESTIMATE_USD) * config.usdToInr * 100) / 100,
        canonicalVisualAssets: true,
        optimization: optimizedMedia.metadata,
        legacySvgFallback: false,
        audio: false,
        warnings
    };

    const updated = {
        ...analysis,
        slides: analysis.slides,
        visualMode: 'raster',
        visualProvider: 'openai',
        visualPromptProvider: 'deterministic_course_grounded',
        mediaProvider: 'openai',
        openAiMedia: mediaMetadata
    };

    emit(onProgress, {
        percent: 78,
        stage: 'Course images ready',
        detail: `${totalImagesGenerated} course visuals are ready.`
    });
    logger.info('scorm_openai_raster_media_ready', {
        module: 'scorm',
        imageModel,
        promptModel,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        requiredImages,
        imageConcurrency: config.imageConcurrency,
        files: files.length,
        optimizedBytes: optimizedMedia.metadata.optimizedBytes,
        imageSavingsPercent: optimizedMedia.metadata.savingsPercent,
        warnings: warnings.length
    });

    return { analysis: updated, files, metadata: mediaMetadata };
}

function coverImagePrompt(analysis) {
    return coverInstruction(analysis);
}

function slideImagePrompt(slide, courseTitle) {
    return slideInstruction(slide, { title: courseTitle }, 0);
}

function recoverySlideImagePrompt(slide, courseTitle) {
    return slideImagePrompt(slide, courseTitle);
}

function noHumanNoTextRules() {
    return sharedVisualRules();
}

module.exports = {
    prepareOpenAiCourseMedia,
    mediaConfig,
    getApiKey,
    runWithConcurrency,
    imageSlideIndexes,
    sentenceExcerpt,
    isHighlyInteractiveAnalysis,
    highlyInteractiveTopicPrompt,
    anchorHighlyInteractivePrompt,
    highlyInteractiveCoverPrompt,
    anchorHighlyInteractiveCoverPrompt,
    coverImagePrompt,
    slideImagePrompt,
    recoverySlideImagePrompt,
    isRetryableImageError,
    retryDelayMs,
    warningSummary,
    noHumanNoTextRules,
    clearLegacyVisuals,
    assignRasterVisual,
    DEFAULT_IMAGE_MODEL,
    DEFAULT_TEXT_MODEL
};
