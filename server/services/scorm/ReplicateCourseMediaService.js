const logger = require('../../utils/logger');
const {
    hasReplicateToken,
    runReplicateModel,
    outputUrl,
    downloadReplicateAsset,
    predictionRequestsPerMinute
} = require('./ReplicateClient');
const {
    generateCoverVisualPrompt,
    generateSlideVisualPrompt
} = require('./GeminiServiceAccountVisualPromptService');
const {
    coverInstruction,
    slideInstruction,
    sharedVisualRules
} = require('./GeminiSlideVisualPromptService');

const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-schnell';
const IMAGE_UNIT_USD = 0.003;

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function mediaConfig() {
    return {
        enabled: String(process.env.REPLICATE_SCORM_MEDIA || 'true').trim().toLowerCase() !== 'false',
        imageModel: clean(process.env.REPLICATE_IMAGE_MODEL || DEFAULT_IMAGE_MODEL),
        maxImages: clampInt(process.env.REPLICATE_SCORM_MAX_IMAGES, 8, 1, 8),
        minImages: clampInt(process.env.REPLICATE_SCORM_MIN_IMAGES, 6, 1, 8),
        imageMegapixels: String(process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS || '1').trim(),
        imageQuality: clampInt(process.env.REPLICATE_SCORM_IMAGE_QUALITY, 82, 50, 100),
        imageRetries: clampInt(process.env.REPLICATE_SCORM_IMAGE_RETRIES, 2, 0, 4),
        imageConcurrency: 1,
        retryBaseMs: clampInt(process.env.REPLICATE_SCORM_IMAGE_RETRY_BASE_MS, 1400, 700, 10000)
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
    if (code === 'REPLICATE_API_ERROR') return Number(error?.status || 0) >= 500;
    return [
        'REPLICATE_NETWORK',
        'REPLICATE_TIMEOUT',
        'REPLICATE_RATE_LIMIT',
        'REPLICATE_PREDICTION_FAILED',
        'REPLICATE_CANCELED',
        'REPLICATE_MEDIA_DOWNLOAD',
        'REPLICATE_IMAGE_EMPTY',
        'REPLICATE_OUTPUT_INVALID',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND'
    ].includes(code) || Number(error?.status || 0) >= 500;
}

function retryDelayMs(error, attempt, config) {
    const rateLimited = String(error?.code || '') === 'REPLICATE_RATE_LIMIT' || Number(error?.status || 0) === 429;
    const base = rateLimited ? Math.max(3000, config.retryBaseMs * 2) : config.retryBaseMs;
    const exponential = Math.min(30000, base * Math.pow(2, Math.max(0, attempt)));
    const serverWait = Math.max(0, Number(error?.retryAfterMs || 0));
    return Math.min(60000, Math.max(exponential, serverWait > 0 ? serverWait + 500 : 0));
}

function rateLimitDetail(state) {
    const seconds = Math.max(1, Math.ceil(Number(state?.waitMs || 0) / 1000));
    const rpm = Number(state?.rateLimitPerMinute || predictionRequestsPerMinute());
    return `Replicate allows ${rpm} new prediction request(s) per minute. The next image request will start in about ${seconds}s.`;
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
        delete next.imagePromptAuth;
    }
    return next;
}

function assignRasterVisual(slide, path, promptInfo) {
    slide.rasterVisualAsset = path;
    slide.visualAsset = path;
    slide.mobileVisualAsset = path;
    slide.visualSource = 'ai_raster';
    slide.visualAssetType = 'image/webp';
    slide.imagePrompt = promptInfo.prompt;
    slide.imagePromptProvider = 'gemini_service_account';
    slide.imagePromptAuth = 'service_account';
    slide.imagePromptModel = promptInfo.model;
    return slide;
}

async function generateImage(prompt, path, config, onStatus, checkCancelled = null) {
    let lastError = null;
    const attempts = 1 + config.imageRetries;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            if (typeof checkCancelled === 'function') checkCancelled();
            if (attempt > 0 && typeof onStatus === 'function') {
                onStatus({ status: 'retrying', attempt: attempt + 1, lastError });
            }
            const output = await runReplicateModel(config.imageModel, {
                prompt,
                go_fast: true,
                megapixels: config.imageMegapixels,
                num_outputs: 1,
                aspect_ratio: '16:9',
                output_format: 'webp',
                output_quality: config.imageQuality,
                num_inference_steps: 4,
                disable_safety_checker: false
            }, {
                timeoutMs: Number(process.env.REPLICATE_SCORM_IMAGE_TIMEOUT_MS || 180000),
                onStatus
            });
            if (typeof checkCancelled === 'function') checkCancelled();
            const url = outputUrl(output);
            if (!url) {
                const error = new Error('Replicate image model returned no output URL.');
                error.code = 'REPLICATE_IMAGE_EMPTY';
                throw error;
            }
            const body = await downloadReplicateAsset(url);
            if (typeof checkCancelled === 'function') checkCancelled();
            if (!body || body.length < 512) {
                const error = new Error('Replicate image download was empty or incomplete.');
                error.code = 'REPLICATE_IMAGE_EMPTY';
                throw error;
            }
            return { path, body, contentType: 'image/webp' };
        } catch (error) {
            if (isGenerationCancelled(error)) throw error;
            lastError = error;
            if (attempt >= attempts - 1 || !isRetryableImageError(error)) break;
            if (typeof checkCancelled === 'function') checkCancelled();
            const delayMs = retryDelayMs(error, attempt, config);
            logger.warn('scorm_replicate_image_retry', {
                module: 'scorm',
                path,
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
    throw lastError || new Error('Replicate image generation failed.');
}

async function prepareReplicateCourseMedia(rawAnalysis, opts = {}) {
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
    analysis.visualProvider = 'replicate';
    analysis.visualPromptProvider = 'gemini_service_account';

    const config = mediaConfig();
    if (!config.enabled || !hasReplicateToken()) {
        emit(onProgress, {
            percent: 42,
            stage: 'Image generation unavailable',
            detail: 'Replicate FLUX Schnell image generation is not configured.'
        });
        const error = new Error('Replicate image generation is required. Configure REPLICATE_API_TOKEN and keep REPLICATE_SCORM_MEDIA enabled.');
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

    emit(onProgress, {
        percent: 7,
        stage: 'Planning course visuals with Gemini',
        detail: `Gemini service-account access is creating the cover and ${selectedIndexes.length} slide prompts. Replicate FLUX Schnell will render them.`
    });

    try {
        checkCancelled();
        const coverPrompt = await generateCoverVisualPrompt({ ...analysis, slides });
        promptModel = promptModel || coverPrompt.model;
        analysis.coverImagePrompt = coverPrompt.prompt;
        analysis.coverImagePromptProvider = 'gemini_service_account';
        analysis.coverImagePromptModel = coverPrompt.model;

        const coverPath = 'assets/media/course-cover.webp';
        const coverFile = await generateImage(coverPrompt.prompt, coverPath, config, (state) => {
            checkCancelled();
            const status = String(state?.status || '').toLowerCase();
            if (status === 'rate_limit_wait') emit(onProgress, {
                percent: 11,
                stage: 'Waiting for Replicate rate-limit slot',
                detail: rateLimitDetail(state),
                modelStatus: status
            });
            if (status === 'starting') emit(onProgress, {
                percent: 12,
                stage: 'Starting cover image',
                detail: 'Replicate FLUX Schnell accepted the Gemini service-account cover prompt.',
                modelStatus: status,
                predictionId: state.predictionId || ''
            });
            if (status === 'processing') emit(onProgress, {
                percent: 16,
                stage: 'Generating course cover image',
                detail: 'Replicate FLUX Schnell is rendering the 16:9 cover image.',
                modelStatus: status,
                predictionId: state.predictionId || ''
            });
            if (status === 'retrying') emit(onProgress, {
                percent: 13,
                stage: 'Retrying course cover image',
                detail: 'Retrying the cover after a temporary Replicate image-service issue.'
            });
        }, checkCancelled);

        files.push(coverFile);
        analysis.coverImageAsset = coverPath;
        analysis.coverVisualAsset = coverPath;
        analysis.coverMobileVisualAsset = coverPath;
        coverGenerated = true;
    } catch (error) {
        if (isGenerationCancelled(error)) throw error;
        warnings.push(`Cover image: ${error.message}`);
        logger.warn('scorm_replicate_course_cover_failed', {
            module: 'scorm',
            code: error.code || null,
            status: error.status || null,
            error: error.message
        });
    }

    let completedJobs = 0;
    for (const slideIndex of selectedIndexes) {
        checkCancelled();
        const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
        try {
            const basePercent = 22 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 40);
            emit(onProgress, {
                percent: basePercent,
                stage: `Writing slide ${slideIndex + 1} image prompt with Gemini`,
                detail: `Gemini service-account access is creating the slide-specific image prompt (${completedJobs + 1} of ${selectedIndexes.length}).`
            });
            const promptInfo = await generateSlideVisualPrompt(
                slides[slideIndex],
                { ...analysis, slides },
                slideIndex
            );
            promptModel = promptModel || promptInfo.model;

            const file = await generateImage(promptInfo.prompt, path, config, (state) => {
                checkCancelled();
                const status = String(state?.status || '').toLowerCase();
                if (status === 'rate_limit_wait') emit(onProgress, {
                    percent: basePercent,
                    stage: `Waiting to generate slide ${slideIndex + 1} image`,
                    detail: rateLimitDetail(state),
                    modelStatus: status
                });
                if (status === 'starting' || status === 'processing') emit(onProgress, {
                    percent: Math.min(68, basePercent + 2),
                    stage: `Generating slide ${slideIndex + 1} image`,
                    detail: 'Replicate FLUX Schnell is rendering the Gemini service-account prompt.',
                    modelStatus: status,
                    predictionId: state.predictionId || ''
                });
                if (status === 'retrying') emit(onProgress, {
                    percent: basePercent,
                    stage: `Retrying slide ${slideIndex + 1} image`,
                    detail: 'Retrying this image after a temporary Replicate failure.'
                });
            }, checkCancelled);

            files.push(file);
            assignRasterVisual(slides[slideIndex], path, promptInfo);
            successfulSlideIndexes.add(slideIndex);
            slideImagesGenerated += 1;
        } catch (error) {
            if (isGenerationCancelled(error)) throw error;
            warnings.push(`Slide ${slideIndex + 1} image: ${error.message}`);
            logger.warn('scorm_replicate_slide_image_failed', {
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
                detail: `${completedJobs} of ${selectedIndexes.length} Replicate FLUX Schnell image jobs completed.`
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
            detail: 'Replicate is retrying missing FLUX Schnell visual slots before packaging the course.'
        });
        for (const slideIndex of recoveryCandidates) {
            checkCancelled();
            if (slideImagesGenerated >= requiredSlideImages) break;
            const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
            try {
                const promptInfo = await generateSlideVisualPrompt(
                    slides[slideIndex],
                    { ...analysis, slides },
                    slideIndex
                );
                const file = await generateImage(promptInfo.prompt, path, config, (state) => {
                    checkCancelled();
                    if (String(state?.status || '').toLowerCase() === 'rate_limit_wait') emit(onProgress, {
                        percent: 70,
                        stage: `Waiting to recover slide ${slideIndex + 1} image`,
                        detail: rateLimitDetail(state),
                        modelStatus: 'rate_limit_wait'
                    });
                }, checkCancelled);
                files.push(file);
                assignRasterVisual(slides[slideIndex], path, promptInfo);
                successfulSlideIndexes.add(slideIndex);
                slideImagesGenerated += 1;
            } catch (error) {
                if (isGenerationCancelled(error)) throw error;
                warnings.push(`Recovery slide ${slideIndex + 1}: ${error.message}`);
                logger.warn('scorm_replicate_slide_image_recovery_failed', {
                    module: 'scorm',
                    slideIndex,
                    code: error.code || null,
                    status: error.status || null,
                    error: error.message
                });
            }
        }
    }

    checkCancelled();
    if (!coverGenerated || slideImagesGenerated < requiredSlideImages) {
        const totalGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
        const reason = warningSummary(warnings);
        const error = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required.${reason ? ` Replicate reported: ${reason}` : ''}`);
        error.code = 'REPLICATE_IMAGES_INCOMPLETE';
        error.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: error.message });
        throw error;
    }

    const totalImagesGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
    const mediaMetadata = {
        provider: 'replicate',
        imageModel: config.imageModel,
        visualPromptProvider: 'gemini_service_account',
        visualPromptModel: promptModel,
        imageMegapixels: config.imageMegapixels,
        estimatedImageUnitUsd: IMAGE_UNIT_USD,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        estimatedImageCostUsd: Number((totalImagesGenerated * IMAGE_UNIT_USD).toFixed(4)),
        maxImages: config.maxImages,
        minImages: requiredImages,
        predictionRequestsPerMinute: predictionRequestsPerMinute(),
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
        visualProvider: 'replicate',
        visualPromptProvider: 'gemini_service_account',
        mediaProvider: 'replicate',
        replicateMedia: mediaMetadata
    };

    emit(onProgress, {
        percent: 76,
        stage: 'Course images ready',
        detail: `${totalImagesGenerated} Replicate FLUX Schnell images are attached to the course.`
    });
    logger.info('scorm_replicate_raster_media_ready', {
        module: 'scorm',
        imageModel: config.imageModel,
        promptModel,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        requiredImages,
        predictionRequestsPerMinute: predictionRequestsPerMinute(),
        files: files.length,
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
