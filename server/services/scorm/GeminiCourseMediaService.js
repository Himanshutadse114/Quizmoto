const logger = require('../../utils/logger');
const {
    generateCoverVisualPrompt,
    generateSlideVisualPrompt
} = require('./GeminiSlideVisualPromptService');
const {
    coverInstruction,
    slideInstruction,
    sharedVisualRules
} = require('./GeminiSlideVisualPromptService');
const { optimizeCourseMedia } = require('./ScormImageOptimizationService');

const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';

if (!process.env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = String(process.env.GOOGLE_TEXT_MODEL || DEFAULT_TEXT_MODEL).trim();
}

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function mediaConfig() {
    return {
        enabled: String(process.env.GEMINI_SCORM_MEDIA || 'true').trim().toLowerCase() !== 'false',
        imageModel: clean(process.env.GOOGLE_IMAGE_MODEL || process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL),
        maxImages: clampInt(process.env.GEMINI_SCORM_MAX_IMAGES, 8, 1, 8),
        minImages: clampInt(process.env.GEMINI_SCORM_MIN_IMAGES, 6, 1, 8),
        imageRetries: clampInt(process.env.GEMINI_SCORM_IMAGE_RETRIES, 2, 0, 4),
        imageConcurrency: clampInt(process.env.GEMINI_SCORM_IMAGE_CONCURRENCY, 2, 1, 3),
        timeoutMs: clampInt(process.env.GEMINI_SCORM_IMAGE_TIMEOUT_MS, 180000, 30000, 300000),
        retryBaseMs: clampInt(process.env.GEMINI_SCORM_IMAGE_RETRY_BASE_MS, 1500, 500, 10000)
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
    slide.imagePromptProvider = 'gemini';
    slide.imagePromptAuth = 'api_key';
    slide.imagePromptModel = promptInfo.model || process.env.GEMINI_MODEL || DEFAULT_TEXT_MODEL;
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
        'GEMINI_IMAGE_NETWORK',
        'GEMINI_IMAGE_TIMEOUT',
        'GEMINI_IMAGE_EMPTY',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND'
    ].includes(String(error?.code || ''));
}

function retryDelayMs(error, attempt, config) {
    const base = Number(error?.status || 0) === 429 ? Math.max(3000, config.retryBaseMs * 2) : config.retryBaseMs;
    return Math.min(30000, base * Math.pow(2, Math.max(0, attempt)));
}

async function requestGeminiImage(apiKey, model, prompt, config) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ['IMAGE'],
                    imageConfig: { aspectRatio: '16:9' }
                }
            })
        });
        const rawText = await response.text();
        if (!response.ok) {
            let code = 'GEMINI_IMAGE_API_ERROR';
            if (response.status === 400 && /api key not valid|invalid api key/i.test(rawText)) code = 'GEMINI_KEY_INVALID';
            else if (response.status === 403) code = 'GEMINI_FORBIDDEN';
            else if (response.status === 404) code = 'GEMINI_MODEL_NOT_FOUND';
            else if (response.status === 429) code = 'GEMINI_QUOTA';
            throw imageError(`Gemini image request failed (${response.status})`, code, response.status, rawText);
        }

        let payload;
        try {
            payload = JSON.parse(rawText);
        } catch (_) {
            throw imageError('Gemini image API returned invalid JSON.', 'GEMINI_IMAGE_RESPONSE_INVALID');
        }

        const parts = Array.isArray(payload?.candidates?.[0]?.content?.parts)
            ? payload.candidates[0].content.parts
            : [];
        const imagePart = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
        const inline = imagePart?.inlineData || imagePart?.inline_data;
        if (!inline?.data) {
            const blockReason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason || '';
            throw imageError(
                `Gemini image model returned no image${blockReason ? ` (${blockReason})` : ''}.`,
                'GEMINI_IMAGE_EMPTY'
            );
        }

        const body = Buffer.from(inline.data, 'base64');
        if (!body || body.length < 512) {
            throw imageError('Gemini image payload was empty or incomplete.', 'GEMINI_IMAGE_EMPTY');
        }
        return {
            body,
            contentType: inline.mimeType || inline.mime_type || 'image/png'
        };
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw imageError('Gemini image generation timed out.', 'GEMINI_IMAGE_TIMEOUT');
        }
        if (error?.code) throw error;
        throw imageError(`Gemini image network error: ${error.message}`, 'GEMINI_IMAGE_NETWORK');
    } finally {
        clearTimeout(timeout);
    }
}

async function generateImage(prompt, pathStem, config, onStatus, checkCancelled = null) {
    const apiKey = getApiKey();
    if (!apiKey) throw imageError('GEMINI_API_KEY is not configured on the server.', 'GEMINI_KEY_MISSING');

    const preferredModel = config.imageModel || DEFAULT_IMAGE_MODEL;
    const models = [preferredModel, DEFAULT_IMAGE_MODEL].filter((model, index, all) => model && all.indexOf(model) === index);
    let lastError = null;

    for (const model of models) {
        for (let attempt = 0; attempt <= config.imageRetries; attempt += 1) {
            try {
                if (typeof checkCancelled === 'function') checkCancelled();
                if (typeof onStatus === 'function') onStatus({ status: attempt ? 'retrying' : 'starting', attempt: attempt + 1, model });
                const generated = await requestGeminiImage(apiKey, model, prompt, config);
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
                logger.warn('scorm_gemini_image_retry', {
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
            }
        }
    }
    throw lastError || imageError('Gemini image generation failed.', 'GEMINI_IMAGE_API_ERROR');
}

async function prepareGeminiCourseMedia(rawAnalysis, opts = {}) {
    const onProgress = opts.onProgress;
    const checkCancelled = typeof opts.checkCancelled === 'function' ? opts.checkCancelled : () => {};
    checkCancelled();

    const config = mediaConfig();
    const key = getApiKey();
    if (!config.enabled || !key) {
        emit(onProgress, {
            percent: 42,
            stage: 'Image generation unavailable',
            detail: 'Course visuals are temporarily unavailable.'
        });
        const error = new Error('Gemini image generation is required. Configure GEMINI_API_KEY (or GOOGLE_API_KEY) and keep GEMINI_SCORM_MEDIA enabled.');
        error.code = 'GEMINI_KEY_MISSING';
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
    analysis.visualProvider = 'gemini';
    analysis.visualPromptProvider = 'gemini';

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
        percent: 7,
        stage: 'Planning course visuals',
        detail: 'Planning a relevant visual for each learning section.'
    });

    try {
        checkCancelled();
        const coverPrompt = await generateCoverVisualPrompt({ ...analysis, slides });
        promptModel = coverPrompt.model || promptModel;
        analysis.coverImagePrompt = coverPrompt.prompt;
        analysis.coverImagePromptProvider = 'gemini';
        analysis.coverImagePromptAuth = 'api_key';
        analysis.coverImagePromptModel = coverPrompt.model;

        const coverFile = await generateImage(coverPrompt.prompt, 'assets/media/course-cover', config, (state) => {
            if (state.status === 'starting') emit(onProgress, {
                percent: 12,
                stage: 'Generating course cover image',
                detail: 'Creating the course cover visual.'
            });
            if (state.status === 'retrying') emit(onProgress, {
                percent: 13,
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
    } catch (error) {
        if (isGenerationCancelled(error)) throw error;
        warnings.push(`Cover image: ${error.message}`);
        logger.warn('scorm_gemini_course_cover_failed', {
            module: 'scorm',
            code: error.code || null,
            status: error.status || null,
            error: error.message
        });
    }

    let completedJobs = 0;
    await runWithConcurrency(selectedIndexes, config.imageConcurrency, async (slideIndex, jobPosition) => {
        checkCancelled();
        const startedAtCompleted = completedJobs;
        const basePercent = 22 + Math.round((startedAtCompleted / Math.max(1, selectedIndexes.length)) * 40);
        try {
            emit(onProgress, {
                percent: basePercent,
                stage: `Planning slide ${slideIndex + 1} visual`,
                detail: `Preparing visual ${jobPosition + 1} of ${selectedIndexes.length}.`
            });
            const promptInfo = await generateSlideVisualPrompt(slides[slideIndex], { ...analysis, slides }, slideIndex);
            promptModel = promptModel || promptInfo.model;
            const file = await generateImage(
                promptInfo.prompt,
                `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}`,
                config,
                (state) => {
                    if (state.status === 'starting') emit(onProgress, {
                        percent: Math.min(68, basePercent + 2),
                        stage: `Generating slide ${slideIndex + 1} image`,
                        detail: 'Creating a visual for this learning section.'
                    });
                    if (state.status === 'retrying') emit(onProgress, {
                        percent: basePercent,
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
            logger.warn('scorm_gemini_slide_image_failed', {
                module: 'scorm',
                slideIndex,
                code: error.code || null,
                status: error.status || null,
                error: error.message
            });
        } finally {
            completedJobs += 1;
            emit(onProgress, {
                percent: 24 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 44),
                stage: 'Generating learning-slide images',
                detail: `${completedJobs} of ${selectedIndexes.length} course visuals completed.`
            });
        }
    });

    if (coverGenerated && slideImagesGenerated < requiredSlideImages) {
        const recoveryCandidates = [
            ...selectedIndexes.filter((index) => !successfulSlideIndexes.has(index)),
            ...slides.map((_, index) => index).filter((index) => !successfulSlideIndexes.has(index) && !selectedIndexes.includes(index))
        ];
        for (const slideIndex of recoveryCandidates) {
            checkCancelled();
            if (slideImagesGenerated >= requiredSlideImages) break;
            try {
                const promptInfo = await generateSlideVisualPrompt(slides[slideIndex], { ...analysis, slides }, slideIndex);
                const file = await generateImage(
                    promptInfo.prompt,
                    `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}`,
                    config,
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
        const error = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required.${reason ? ` Gemini reported: ${reason}` : ''}`);
        error.code = 'REPLICATE_IMAGES_INCOMPLETE';
        error.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: error.message });
        throw error;
    }

    emit(onProgress, {
        percent: 73,
        stage: 'Optimising course images',
        detail: 'Optimising every visual for consistent, fast loading.'
    });
    const optimizedMedia = await optimizeCourseMedia(analysis, files);
    analysis = optimizedMedia.analysis;
    files = optimizedMedia.files;

    const totalImagesGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
    const mediaMetadata = {
        provider: 'gemini',
        auth: 'api_key',
        textModel: process.env.GEMINI_MODEL || DEFAULT_TEXT_MODEL,
        imageModel,
        visualPromptProvider: 'gemini',
        visualPromptModel: promptModel,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        maxImages: config.maxImages,
        minImages: requiredImages,
        imageConcurrency: config.imageConcurrency,
        selectedSlideIndexes: selectedIndexes,
        successfulSlideIndexes: Array.from(successfulSlideIndexes).sort((a, b) => a - b),
        imageStyle: 'gemini_generated_16_9_non_human_no_text',
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
        visualProvider: 'gemini',
        visualPromptProvider: 'gemini',
        mediaProvider: 'gemini',
        geminiMedia: mediaMetadata,
        replicateMedia: mediaMetadata
    };

    emit(onProgress, {
        percent: 76,
        stage: 'Course images ready',
        detail: `${totalImagesGenerated} course visuals are ready.`
    });
    logger.info('scorm_gemini_raster_media_ready', {
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
    prepareGeminiCourseMedia,
    prepareReplicateCourseMedia: prepareGeminiCourseMedia,
    mediaConfig,
    getApiKey,
    runWithConcurrency,
    imageSlideIndexes,
    sentenceExcerpt,
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
