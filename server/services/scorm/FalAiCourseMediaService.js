const logger = require('../../utils/logger');
const {
    generateImage: generateFalImage,
    isFalConfigured,
    DEFAULT_FAL_MODEL
} = require('./FalAiClient');
const {
    generateCoverVisualPrompt,
    generateSlideVisualPrompt
} = require('./GeminiServiceAccountVisualPromptService');
const {
    coverInstruction,
    slideInstruction,
    sharedVisualRules
} = require('./GeminiSlideVisualPromptService');

const DEFAULT_IMAGE_MODEL = DEFAULT_FAL_MODEL;
// fal.ai currently prices FLUX.1 Schnell at $0.003 per megapixel.
const IMAGE_UNIT_USD = 0.003;

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function numberOr(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function mediaConfig() {
    const outputFormat = clean(process.env.FAL_SCORM_OUTPUT_FORMAT || 'jpeg').toLowerCase();
    const acceleration = clean(process.env.FAL_SCORM_ACCELERATION || 'regular').toLowerCase();
    return {
        enabled: String(process.env.FAL_SCORM_MEDIA || 'true').trim().toLowerCase() !== 'false',
        imageModel: clean(process.env.FAL_IMAGE_MODEL || DEFAULT_IMAGE_MODEL),
        maxImages: clampInt(
            process.env.FAL_SCORM_MAX_IMAGES || process.env.VERTEX_SCORM_MAX_IMAGES || process.env.REPLICATE_SCORM_MAX_IMAGES,
            8,
            1,
            8
        ),
        minImages: clampInt(
            process.env.FAL_SCORM_MIN_IMAGES || process.env.VERTEX_SCORM_MIN_IMAGES || process.env.REPLICATE_SCORM_MIN_IMAGES,
            6,
            1,
            8
        ),
        width: clampInt(process.env.FAL_SCORM_IMAGE_WIDTH, 1280, 512, 1920),
        height: clampInt(process.env.FAL_SCORM_IMAGE_HEIGHT, 720, 512, 1920),
        outputFormat: ['jpeg', 'png'].includes(outputFormat) ? outputFormat : 'jpeg',
        acceleration: ['none', 'regular', 'high'].includes(acceleration) ? acceleration : 'regular',
        numInferenceSteps: clampInt(process.env.FAL_SCORM_INFERENCE_STEPS, 4, 1, 12),
        imageRetries: clampInt(process.env.FAL_SCORM_IMAGE_RETRIES, 2, 0, 4),
        retryBaseMs: clampInt(process.env.FAL_SCORM_IMAGE_RETRY_BASE_MS, 900, 300, 10000),
        imageUnitUsd: numberOr(process.env.FAL_IMAGE_UNIT_USD, IMAGE_UNIT_USD, 0, 10)
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

function sentenceExcerpt(value, maxChars) {
    const text = clean(value);
    if (!text || maxChars <= 0) return '';
    if (text.length <= maxChars) return text;
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    let result = '';
    for (const sentence of sentences) {
        const next = clean(sentence);
        if (!next) continue;
        const candidate = result ? `${result} ${next}` : next;
        if (candidate.length > maxChars) break;
        result = candidate;
    }
    if (result.length >= Math.min(120, maxChars * 0.45)) return result;
    return `${text.slice(0, maxChars).replace(/\s+\S*$/, '').replace(/[,:;\-]+$/, '').trim()}…`;
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

function isRetryableImageError(error) {
    const code = String(error?.code || '');
    if (code === 'FAL_API_ERROR') return Number(error?.status || 0) >= 500;
    return [
        'FAL_NETWORK',
        'FAL_TIMEOUT',
        'FAL_RATE_LIMIT',
        'FAL_UNAVAILABLE',
        'FAL_MEDIA_DOWNLOAD',
        'FAL_IMAGE_EMPTY',
        'FAL_OUTPUT_INVALID',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND'
    ].includes(code) || Number(error?.status || 0) >= 500;
}

function retryDelayMs(error, attempt, config) {
    const rateLimited = String(error?.code || '') === 'FAL_RATE_LIMIT' || Number(error?.status || 0) === 429;
    const base = rateLimited ? Math.max(1800, config.retryBaseMs * 2) : config.retryBaseMs;
    const exponential = Math.min(30000, base * Math.pow(2, Math.max(0, attempt)));
    const serverWait = Math.max(0, Number(error?.retryAfterMs || 0));
    return Math.min(60000, Math.max(exponential, serverWait > 0 ? serverWait + 250 : 0));
}

function rateLimitDetail() {
    return 'fal.ai is temporarily at its concurrency limit. The FLUX Schnell image request will retry automatically.';
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

function promptWasServiceAccountGenerated(provider, auth) {
    const name = clean(provider).toLowerCase();
    if (['gemini_service_account', 'vertex_ai'].includes(name)) return true;
    return name === 'gemini' && clean(auth).toLowerCase() === 'service_account';
}

function clearUntrustedPrompt(slide, analysisProvider) {
    const next = { ...(slide || {}) };
    const provider = next.imagePromptProvider || analysisProvider;
    if (!promptWasServiceAccountGenerated(provider, next.imagePromptAuth)) {
        delete next.imagePrompt;
        delete next.imagePromptProvider;
        delete next.imagePromptModel;
    }
    return next;
}

function assignRasterVisual(slide, path, promptInfo) {
    slide.rasterVisualAsset = path;
    slide.visualAsset = path;
    slide.mobileVisualAsset = path;
    slide.visualSource = 'ai_raster';
    slide.visualAssetType = /\.png$/i.test(path) ? 'image/png' : 'image/jpeg';
    slide.imagePrompt = promptInfo.prompt;
    slide.imagePromptProvider = 'gemini';
    slide.imagePromptAuth = 'service_account';
    slide.imagePromptModel = promptInfo.model;
    return slide;
}

function imageExtension(config) {
    return config.outputFormat === 'png' ? 'png' : 'jpg';
}

async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(prompt, path, config, onProgress, checkCancelled) {
    let lastError = null;
    const attempts = 1 + config.imageRetries;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            checkCancelled();
            if (attempt > 0) {
                emit(onProgress, {
                    stage: 'Retrying FLUX Schnell image',
                    detail: `Retrying a temporary fal.ai image failure (attempt ${attempt + 1} of ${attempts}).`
                });
            }
            const result = await generateFalImage({
                prompt,
                model: config.imageModel,
                width: config.width,
                height: config.height,
                outputFormat: config.outputFormat,
                acceleration: config.acceleration,
                numInferenceSteps: config.numInferenceSteps
            });
            checkCancelled();
            return {
                path,
                body: result.body,
                contentType: result.contentType || (config.outputFormat === 'png' ? 'image/png' : 'image/jpeg'),
                requestId: result.requestId || null
            };
        } catch (error) {
            if (isGenerationCancelled(error)) throw error;
            lastError = error;
            if (attempt >= attempts - 1 || !isRetryableImageError(error)) break;
            const delayMs = retryDelayMs(error, attempt, config);
            if (String(error?.code || '') === 'FAL_RATE_LIMIT' || Number(error?.status || 0) === 429) {
                emit(onProgress, { stage: 'Waiting for fal.ai capacity', detail: rateLimitDetail() });
            }
            logger.warn('scorm_fal_image_retry', {
                module: 'scorm',
                path,
                attempt: attempt + 1,
                nextAttempt: attempt + 2,
                delayMs,
                code: error.code || null,
                status: error.status || null,
                requestId: error.requestId || null,
                error: error.message
            });
            await sleep(delayMs);
        }
    }
    throw lastError || new Error('fal.ai FLUX Schnell image generation failed.');
}

async function prepareFalAiCourseMedia(rawAnalysis, opts = {}) {
    const onProgress = opts.onProgress;
    const checkCancelled = typeof opts.checkCancelled === 'function' ? opts.checkCancelled : () => {};
    checkCancelled();

    const source = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    const analysisProvider = source.visualPromptProvider || source.coverImagePromptProvider;
    const slides = (Array.isArray(source.slides) ? source.slides : [])
        .map(clearLegacyVisuals)
        .map((slide) => clearUntrustedPrompt(slide, analysisProvider));
    const analysis = { ...source, slides };

    delete analysis.narrationAsset;
    delete analysis.narrationText;
    delete analysis.coverImageAsset;
    delete analysis.coverVisualAsset;
    delete analysis.coverMobileVisualAsset;

    if (!promptWasServiceAccountGenerated(analysis.coverImagePromptProvider || analysis.visualPromptProvider)) {
        delete analysis.coverImagePrompt;
        delete analysis.coverImagePromptProvider;
        delete analysis.coverImagePromptModel;
    }

    analysis.visualMode = 'raster';
    analysis.visualProvider = 'fal_ai';
    analysis.visualPromptProvider = 'gemini_service_account';

    const config = mediaConfig();
    if (!config.enabled || !isFalConfigured()) {
        emit(onProgress, {
            percent: 42,
            stage: 'Image generation unavailable',
            detail: 'fal.ai FLUX Schnell image generation is not configured.'
        });
        const error = new Error('fal.ai FLUX Schnell image generation is required. Add FAL_KEY to the backend environment and keep FAL_SCORM_MEDIA enabled.');
        // The author route already maps this compatibility code to a useful 502.
        error.code = 'REPLICATE_IMAGES_REQUIRED';
        throw error;
    }

    const files = [];
    const warnings = [];
    const successfulSlideIndexes = new Set();
    let coverGenerated = false;
    let slideImagesGenerated = 0;
    let promptModel = analysis.visualPromptModel || null;

    const selectedIndexes = imageSlideIndexes(
        slides,
        Math.min(Math.max(0, config.maxImages - 1), slides.length)
    );
    const availableImageSlots = 1 + selectedIndexes.length;
    const requiredImages = Math.min(availableImageSlots, config.maxImages, config.minImages);
    const requiredSlideImages = Math.max(0, requiredImages - 1);
    const extension = imageExtension(config);

    emit(onProgress, {
        percent: 38,
        stage: 'Generating course images with FLUX Schnell',
        detail: `fal.ai is creating one 16:9 cover and up to ${selectedIndexes.length} slide visuals with ${config.imageModel}.`
    });

    try {
        checkCancelled();
        const coverPrompt = await generateCoverVisualPrompt({ ...analysis, slides });
        promptModel = promptModel || coverPrompt.model;
        analysis.coverImagePrompt = coverPrompt.prompt;
        analysis.coverImagePromptProvider = 'gemini_service_account';
        analysis.coverImagePromptModel = coverPrompt.model;

        emit(onProgress, {
            percent: 40,
            stage: 'Generating course cover image',
            detail: 'fal.ai FLUX Schnell is rendering the Gemini service-account cover prompt in 16:9.'
        });
        const coverPath = `assets/media/course-cover.${extension}`;
        const coverFile = await generateImage(coverPrompt.prompt, coverPath, config, onProgress, checkCancelled);
        files.push(coverFile);
        analysis.coverImageAsset = coverPath;
        analysis.coverVisualAsset = coverPath;
        analysis.coverMobileVisualAsset = coverPath;
        coverGenerated = true;
    } catch (error) {
        if (isGenerationCancelled(error)) throw error;
        warnings.push(`Cover image: ${error.message}`);
        logger.warn('scorm_fal_course_cover_failed', {
            module: 'scorm',
            code: error.code || null,
            status: error.status || null,
            error: error.message
        });
    }

    let completedJobs = 0;
    for (const slideIndex of selectedIndexes) {
        checkCancelled();
        const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.${extension}`;
        try {
            const basePercent = 44 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 24);
            emit(onProgress, {
                percent: basePercent,
                stage: `Generating slide ${slideIndex + 1} image`,
                detail: `fal.ai FLUX Schnell is rendering the Gemini service-account prompt (${completedJobs + 1} of ${selectedIndexes.length}).`
            });
            const promptInfo = await generateSlideVisualPrompt(
                slides[slideIndex],
                { ...analysis, slides },
                slideIndex
            );
            promptModel = promptModel || promptInfo.model;
            const file = await generateImage(promptInfo.prompt, path, config, onProgress, checkCancelled);
            files.push(file);
            assignRasterVisual(slides[slideIndex], path, promptInfo);
            successfulSlideIndexes.add(slideIndex);
            slideImagesGenerated += 1;
        } catch (error) {
            if (isGenerationCancelled(error)) throw error;
            warnings.push(`Slide ${slideIndex + 1} image: ${error.message}`);
            logger.warn('scorm_fal_slide_image_failed', {
                module: 'scorm',
                slideIndex,
                code: error.code || null,
                status: error.status || null,
                error: error.message
            });
        } finally {
            completedJobs += 1;
            emit(onProgress, {
                percent: 44 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 24),
                stage: 'Generating learning-slide images',
                detail: `${completedJobs} of ${selectedIndexes.length} FLUX Schnell image jobs completed.`
            });
        }
    }

    checkCancelled();
    if (coverGenerated && slideImagesGenerated < requiredSlideImages) {
        const recoveryCandidates = [
            ...selectedIndexes.filter((index) => !successfulSlideIndexes.has(index)),
            ...slides.map((_, index) => index).filter((index) => !successfulSlideIndexes.has(index) && !selectedIndexes.includes(index))
        ];
        emit(onProgress, {
            percent: 69,
            stage: 'Recovering missing course images',
            detail: 'fal.ai is retrying missing FLUX Schnell visual slots before packaging the course.'
        });
        for (const slideIndex of recoveryCandidates) {
            checkCancelled();
            if (slideImagesGenerated >= requiredSlideImages) break;
            const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.${extension}`;
            try {
                const promptInfo = await generateSlideVisualPrompt(
                    slides[slideIndex],
                    { ...analysis, slides },
                    slideIndex
                );
                const file = await generateImage(promptInfo.prompt, path, config, onProgress, checkCancelled);
                files.push(file);
                assignRasterVisual(slides[slideIndex], path, promptInfo);
                successfulSlideIndexes.add(slideIndex);
                slideImagesGenerated += 1;
            } catch (error) {
                if (isGenerationCancelled(error)) throw error;
                warnings.push(`Recovery slide ${slideIndex + 1}: ${error.message}`);
                logger.warn('scorm_fal_slide_image_recovery_failed', {
                    module: 'scorm',
                    slideIndex,
                    code: error.code || null,
                    error: error.message
                });
            }
        }
    }

    checkCancelled();
    if (!coverGenerated || slideImagesGenerated < requiredSlideImages) {
        const totalGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
        const reason = warningSummary(warnings);
        const error = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required.${reason ? ` fal.ai reported: ${reason}` : ''}`);
        error.code = 'REPLICATE_IMAGES_INCOMPLETE';
        error.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: error.message });
        throw error;
    }

    const totalImagesGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
    const megapixelsPerImage = Math.ceil((config.width * config.height) / 1000000);
    const estimatedImageCostUsd = Number((totalImagesGenerated * megapixelsPerImage * config.imageUnitUsd).toFixed(4));
    const mediaMetadata = {
        provider: 'fal_ai',
        imageModel: config.imageModel,
        visualPromptProvider: 'gemini_service_account',
        visualPromptModel: promptModel,
        imageWidth: config.width,
        imageHeight: config.height,
        outputFormat: config.outputFormat,
        acceleration: config.acceleration,
        numInferenceSteps: config.numInferenceSteps,
        estimatedImageUnitUsdPerMegapixel: config.imageUnitUsd,
        estimatedMegapixelsPerImage: megapixelsPerImage,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        estimatedImageCostUsd,
        maxImages: config.maxImages,
        minImages: requiredImages,
        selectedSlideIndexes: selectedIndexes,
        successfulSlideIndexes: Array.from(successfulSlideIndexes).sort((a, b) => a - b),
        imageStyle: 'gemini_service_account_prompted_flux_schnell_non_human_no_text',
        canonicalVisualAssets: true,
        legacySvgFallback: false,
        audio: false,
        warnings
    };

    const updated = {
        ...analysis,
        slides,
        visualMode: 'raster',
        visualProvider: 'fal_ai',
        visualPromptProvider: 'gemini_service_account',
        mediaProvider: 'fal_ai',
        falMedia: mediaMetadata,
        // Retain this alias while package/UI code still uses the old field name.
        replicateMedia: mediaMetadata
    };

    emit(onProgress, {
        percent: 76,
        stage: 'Course images ready',
        detail: `${totalImagesGenerated} fal.ai FLUX Schnell images are attached to the course.`
    });
    logger.info('scorm_fal_raster_media_ready', {
        module: 'scorm',
        imageModel: config.imageModel,
        promptModel,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        requiredImages,
        estimatedImageCostUsd,
        files: files.length,
        warnings: warnings.length
    });

    return { analysis: updated, files, metadata: mediaMetadata };
}

// Compatibility export used by the existing author route. It now calls fal.ai.
const prepareReplicateCourseMedia = prepareFalAiCourseMedia;

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
    prepareFalAiCourseMedia,
    prepareReplicateCourseMedia,
    mediaConfig,
    imageSlideIndexes,
    sentenceExcerpt,
    coverImagePrompt,
    slideImagePrompt,
    recoverySlideImagePrompt,
    isRetryableImageError,
    retryDelayMs,
    rateLimitDetail,
    warningSummary,
    noHumanNoTextRules,
    clearLegacyVisuals,
    assignRasterVisual,
    promptWasServiceAccountGenerated,
    DEFAULT_IMAGE_MODEL,
    IMAGE_UNIT_USD
};
