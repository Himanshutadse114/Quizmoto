const logger = require('../../utils/logger');
const {
    hasReplicateToken,
    runReplicateModel,
    outputUrl,
    downloadReplicateAsset,
    predictionRequestsPerMinute
} = require('./ReplicateClient');
const {
    ensureCourseVisualPrompts,
    fallbackPrompt,
    visualRules
} = require('./GeminiCourseVisualPromptBatchService');

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
        imageModel: DEFAULT_IMAGE_MODEL,
        // Six images total is the production baseline: one cover + five learning slides.
        // A stale Render value below six can no longer silently reduce visual coverage.
        maxImages: clampInt(process.env.REPLICATE_SCORM_MAX_IMAGES, 6, 6, 8),
        minImages: clampInt(process.env.REPLICATE_SCORM_MIN_IMAGES, 6, 6, 8),
        imageMegapixels: String(process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS || '1').trim(),
        imageQuality: clampInt(process.env.REPLICATE_SCORM_IMAGE_QUALITY, 82, 50, 100),
        imageRetries: clampInt(process.env.REPLICATE_SCORM_IMAGE_RETRIES, 2, 2, 4),
        imageConcurrency: 1,
        retryBaseMs: clampInt(process.env.REPLICATE_SCORM_IMAGE_RETRY_BASE_MS, 1400, 700, 5000)
    };
}

function emit(onProgress, patch) {
    if (typeof onProgress !== 'function') return;
    try { onProgress(patch); } catch (_) {}
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

function isRetryableImageError(err) {
    const code = String(err?.code || '');
    if (code === 'REPLICATE_API_ERROR') return Number(err?.status || 0) >= 500;
    return [
        'REPLICATE_NETWORK',
        'REPLICATE_TIMEOUT',
        'REPLICATE_RATE_LIMIT',
        'REPLICATE_PREDICTION_FAILED',
        'REPLICATE_CANCELED',
        'REPLICATE_MEDIA_DOWNLOAD',
        'REPLICATE_IMAGE_EMPTY',
        'REPLICATE_OUTPUT_INVALID'
    ].includes(code);
}

function retryDelayMs(err, attempt, config) {
    const rateLimited = String(err?.code || '') === 'REPLICATE_RATE_LIMIT';
    const base = rateLimited ? Math.max(3000, config.retryBaseMs * 2) : config.retryBaseMs;
    const exponential = Math.min(30000, base * Math.pow(2, Math.max(0, attempt)));
    const serverWait = Math.max(0, Number(err?.retryAfterMs || 0));
    return Math.min(60000, Math.max(exponential, serverWait > 0 ? serverWait + 500 : 0));
}

function rateLimitDetail(state) {
    const seconds = Math.max(1, Math.ceil(Number(state?.waitMs || 0) / 1000));
    const rpm = Number(state?.rateLimitPerMinute || predictionRequestsPerMinute());
    return `Replicate allows ${rpm} new prediction request(s) per minute. The next image request will start in about ${seconds}s.`;
}

async function generateImage(prompt, path, config, onStatus) {
    let lastError = null;
    const attempts = 1 + config.imageRetries;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            if (attempt > 0 && typeof onStatus === 'function') onStatus({ status: 'retrying', attempt: attempt + 1, lastError });
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
            const url = outputUrl(output);
            if (!url) {
                const err = new Error('Replicate image model returned no output URL.');
                err.code = 'REPLICATE_IMAGE_EMPTY';
                throw err;
            }
            const body = await downloadReplicateAsset(url);
            if (!body || body.length < 512) {
                const err = new Error('Replicate image download was empty or incomplete.');
                err.code = 'REPLICATE_IMAGE_EMPTY';
                throw err;
            }
            return { path, body, contentType: 'image/webp' };
        } catch (err) {
            lastError = err;
            if (attempt >= attempts - 1 || !isRetryableImageError(err)) break;
            const delayMs = retryDelayMs(err, attempt, config);
            logger.warn('scorm_replicate_image_retry', {
                module: 'scorm', path, attempt: attempt + 1, nextAttempt: attempt + 2,
                delayMs, code: err.code, status: err.status || null, error: err.message
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    throw lastError || new Error('Replicate image generation failed.');
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

function assignRasterVisual(slide, path, promptInfo = {}) {
    slide.rasterVisualAsset = path;
    slide.visualAsset = path;
    slide.mobileVisualAsset = path;
    slide.visualSource = 'ai_raster';
    slide.visualAssetType = 'image/webp';
    if (promptInfo.prompt) slide.imagePrompt = clean(promptInfo.prompt);
    if (promptInfo.provider) slide.imagePromptProvider = promptInfo.provider;
    if (promptInfo.model) slide.imagePromptModel = promptInfo.model;
    return slide;
}

function promptForSlide(slide, analysis) {
    return clean(slide?.imagePrompt) || fallbackPrompt({
        title: slide?.title,
        content: slide?.content || slide?.introText || slide?.revealText,
        keyPoints: slide?.keyPoints,
        courseTitle: analysis?.title,
        role: 'slide'
    });
}

function promptInfoForSlide(slide, analysis) {
    return {
        prompt: promptForSlide(slide, analysis),
        provider: clean(slide?.imagePromptProvider) || 'gemini',
        model: clean(slide?.imagePromptModel) || clean(analysis?.visualPromptPlan?.model) || null
    };
}

async function prepareReplicateCourseMedia(rawAnalysis, opts = {}) {
    const onProgress = opts.onProgress;
    let analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};

    emit(onProgress, {
        percent: 7,
        stage: 'Loading preplanned course visuals',
        detail: 'Using the single Gemini visual plan created for the cover and every slide. No per-slide Gemini requests are made here.'
    });

    analysis = await ensureCourseVisualPrompts(analysis);
    const slides = Array.isArray(analysis.slides) ? analysis.slides.map(clearLegacyVisuals) : [];

    delete analysis.narrationAsset;
    delete analysis.narrationText;
    delete analysis.coverImageAsset;
    delete analysis.coverVisualAsset;
    delete analysis.coverMobileVisualAsset;

    analysis.visualMode = 'raster';
    analysis.visualProvider = 'replicate';
    analysis.visualPromptProvider = 'gemini';

    const config = mediaConfig();
    if (!config.enabled || !hasReplicateToken()) {
        emit(onProgress, { percent: 12, stage: 'Image generation unavailable', detail: 'Replicate image generation is not configured.' });
        const err = new Error('Replicate image generation is required. Configure REPLICATE_API_TOKEN and keep REPLICATE_SCORM_MEDIA enabled.');
        err.code = 'REPLICATE_IMAGES_REQUIRED';
        throw err;
    }

    const files = [];
    const warnings = [];
    const successfulSlideIndexes = new Set();
    let coverGenerated = false;
    let slideImagesGenerated = 0;
    const promptModel = clean(analysis?.visualPromptPlan?.model) || clean(analysis?.coverImagePromptModel) || null;

    const selectedIndexes = imageSlideIndexes(slides, Math.min(Math.max(0, config.maxImages - 1), slides.length));
    const availableImageSlots = 1 + selectedIndexes.length;
    const requiredImages = Math.min(availableImageSlots, config.maxImages, config.minImages);
    const requiredSlideImages = Math.max(0, requiredImages - 1);

    emit(onProgress, {
        percent: 10,
        stage: 'Rendering planned course images',
        detail: `FLUX Schnell will render one cover and ${selectedIndexes.length} selected slide images from the already-prepared Gemini prompt plan.`
    });

    const coverPrompt = clean(analysis.coverImagePrompt) || fallbackPrompt({
        title: analysis.title,
        content: analysis.summary,
        courseTitle: analysis.title,
        role: 'cover'
    });
    analysis.coverImagePrompt = coverPrompt;

    try {
        const coverPath = 'assets/media/course-cover.webp';
        const coverFile = await generateImage(coverPrompt, coverPath, config, (state) => {
            const status = String(state?.status || '').toLowerCase();
            if (status === 'rate_limit_wait') emit(onProgress, { percent: 12, stage: 'Waiting for Replicate rate-limit slot', detail: rateLimitDetail(state), modelStatus: status });
            if (status === 'starting') emit(onProgress, { percent: 14, stage: 'Starting cover image', detail: 'FLUX Schnell accepted the preplanned cover prompt.', modelStatus: status, predictionId: state.predictionId || '' });
            if (status === 'processing') emit(onProgress, { percent: 17, stage: 'Generating course cover image', detail: 'Rendering the 16:9 cover image.', modelStatus: status, predictionId: state.predictionId || '' });
            if (status === 'retrying') emit(onProgress, { percent: 13, stage: 'Retrying course cover image', detail: 'Retrying the cover after a temporary image-service issue.' });
        });
        files.push(coverFile);
        analysis.coverImageAsset = coverPath;
        analysis.coverVisualAsset = coverPath;
        analysis.coverMobileVisualAsset = coverPath;
        coverGenerated = true;
    } catch (err) {
        warnings.push(`Cover image: ${err.message}`);
        logger.warn('scorm_course_cover_failed', { module: 'scorm', error: err.message, code: err.code, status: err.status || null });
    }

    let completedJobs = 0;
    for (const slideIndex of selectedIndexes) {
        const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
        const promptInfo = promptInfoForSlide(slides[slideIndex], analysis);
        try {
            const basePercent = 22 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 42);
            const file = await generateImage(promptInfo.prompt, path, config, (state) => {
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
                    detail: 'FLUX Schnell is rendering the preplanned slide-specific prompt.',
                    modelStatus: status,
                    predictionId: state.predictionId || ''
                });
                if (status === 'retrying') emit(onProgress, {
                    percent: basePercent,
                    stage: `Retrying slide ${slideIndex + 1} image`,
                    detail: 'Retrying this image after a temporary Replicate failure.'
                });
            });
            files.push(file);
            assignRasterVisual(slides[slideIndex], path, promptInfo);
            successfulSlideIndexes.add(slideIndex);
            slideImagesGenerated += 1;
        } catch (err) {
            warnings.push(`Slide ${slideIndex + 1} image: ${err.message}`);
            logger.warn('scorm_slide_image_failed', { module: 'scorm', slideIndex, error: err.message, code: err.code, status: err.status || null });
        } finally {
            completedJobs += 1;
            emit(onProgress, {
                percent: 24 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 44),
                stage: 'Generating learning-slide images',
                detail: `${completedJobs} of ${selectedIndexes.length} selected image jobs completed.`
            });
        }
    }

    if (coverGenerated && slideImagesGenerated < requiredSlideImages) {
        const recoveryCandidates = [
            ...selectedIndexes.filter((index) => !successfulSlideIndexes.has(index)),
            ...slides.map((_, index) => index).filter((index) => !successfulSlideIndexes.has(index) && !selectedIndexes.includes(index))
        ];
        emit(onProgress, { percent: 69, stage: 'Recovering missing course images', detail: 'Using the already-generated Gemini prompts for alternate slides. No additional Gemini request is needed.' });
        for (const slideIndex of recoveryCandidates) {
            if (slideImagesGenerated >= requiredSlideImages) break;
            const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
            const promptInfo = promptInfoForSlide(slides[slideIndex], analysis);
            try {
                const file = await generateImage(promptInfo.prompt, path, config, (state) => {
                    if (String(state?.status || '').toLowerCase() === 'rate_limit_wait') emit(onProgress, {
                        percent: 70,
                        stage: `Waiting to recover slide ${slideIndex + 1} image`,
                        detail: rateLimitDetail(state),
                        modelStatus: 'rate_limit_wait'
                    });
                });
                files.push(file);
                assignRasterVisual(slides[slideIndex], path, promptInfo);
                successfulSlideIndexes.add(slideIndex);
                slideImagesGenerated += 1;
            } catch (err) {
                warnings.push(`Recovery slide ${slideIndex + 1}: ${err.message}`);
                logger.warn('scorm_slide_image_recovery_failed', { module: 'scorm', slideIndex, error: err.message, code: err.code, status: err.status || null });
            }
        }
    }

    if (!coverGenerated || slideImagesGenerated < requiredSlideImages) {
        const totalGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
        const reason = warningSummary(warnings);
        const err = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required.${reason ? ` Provider reported: ${reason}` : ''}`);
        err.code = 'REPLICATE_IMAGES_INCOMPLETE';
        err.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: err.message });
        throw err;
    }

    const totalImagesGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
    const updated = {
        ...analysis,
        slides,
        visualMode: 'raster',
        visualProvider: 'replicate',
        visualPromptProvider: 'gemini',
        mediaProvider: 'replicate',
        replicateMedia: {
            imageModel: config.imageModel,
            visualPromptProvider: 'gemini',
            visualPromptModel: promptModel,
            visualPromptMode: 'single_batch',
            visualPromptRequests: Number(analysis?.visualPromptPlan?.promptRequests || 0),
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
            imageStyle: 'gemini_batch_directed_simple_non_human_no_text',
            canonicalVisualAssets: true,
            legacySvgFallback: false,
            audio: false,
            warnings
        }
    };

    emit(onProgress, {
        percent: 76,
        stage: 'Canonical course images ready',
        detail: `${totalImagesGenerated} FLUX images are attached directly to the course data. Every generated image will be rendered by the canonical SCORM player.`
    });
    logger.info('scorm_raster_media_ready', {
        module: 'scorm', imageModel: config.imageModel, promptModel, coverGenerated, slideImagesGenerated,
        totalImagesGenerated, requiredImages, predictionRequestsPerMinute: predictionRequestsPerMinute(),
        files: files.length, warnings: warnings.length, visualPromptMode: 'single_batch'
    });

    return { analysis: updated, files, metadata: updated.replicateMedia };
}

// Compatibility/debug helpers. Production prompt generation uses the one-shot
// GeminiCourseVisualPromptBatchService above, never one Gemini call per image.
function coverImagePrompt(analysis) {
    return fallbackPrompt({
        title: analysis?.title,
        content: analysis?.summary,
        courseTitle: analysis?.title,
        role: 'cover'
    });
}

function slideImagePrompt(slide, courseTitle) {
    return fallbackPrompt({
        title: slide?.title,
        content: slide?.content || slide?.introText || slide?.revealText,
        keyPoints: slide?.keyPoints,
        courseTitle,
        role: 'slide'
    });
}

function recoverySlideImagePrompt(slide, courseTitle) {
    return slideImagePrompt(slide, courseTitle);
}

function noHumanNoTextRules() {
    return visualRules();
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
    DEFAULT_IMAGE_MODEL,
    IMAGE_UNIT_USD
};
