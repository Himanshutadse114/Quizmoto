const logger = require('../../utils/logger');
const { generateImage: generateVertexImage, isVertexConfigured, vertexConfig } = require('./VertexAiClient');
const {
    generateCoverVisualPrompt,
    generateSlideVisualPrompt
} = require('./VertexSlideVisualPromptService');
const {
    coverInstruction,
    slideInstruction,
    sharedVisualRules
} = require('./GeminiSlideVisualPromptService');

// The filename and exported prepareReplicateCourseMedia symbol are retained as
// compatibility shims because the author route and older tests import them.
// Actual course image generation is now performed by Google Vertex AI.
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const IMAGE_UNIT_USD = 0.034;

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
        enabled: String(process.env.VERTEX_SCORM_MEDIA || 'true').trim().toLowerCase() !== 'false',
        imageModel: clean(process.env.VERTEX_IMAGE_MODEL || vertexConfig().imageModel || DEFAULT_IMAGE_MODEL),
        maxImages: clampInt(process.env.VERTEX_SCORM_MAX_IMAGES || process.env.REPLICATE_SCORM_MAX_IMAGES, 8, 1, 8),
        minImages: clampInt(process.env.VERTEX_SCORM_MIN_IMAGES || process.env.REPLICATE_SCORM_MIN_IMAGES, 6, 1, 8),
        imageRetries: clampInt(process.env.VERTEX_SCORM_IMAGE_RETRIES, 2, 0, 4),
        retryBaseMs: clampInt(process.env.VERTEX_SCORM_IMAGE_RETRY_BASE_MS, 1200, 300, 10000),
        imageUnitUsd: Number(process.env.VERTEX_IMAGE_UNIT_USD || IMAGE_UNIT_USD)
    };
}

function isGenerationCancelled(err) {
    return String(err?.code || '') === 'SCORM_GENERATION_CANCELLED';
}

function emit(onProgress, patch) {
    if (typeof onProgress !== 'function') return;
    try {
        onProgress(patch);
    } catch (err) {
        if (isGenerationCancelled(err)) throw err;
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

function isRetryableImageError(err) {
    const code = String(err?.code || '');
    return [
        'VERTEX_QUOTA',
        'VERTEX_UNAVAILABLE',
        'VERTEX_API_ERROR',
        'VERTEX_IMAGE_EMPTY',
        'VERTEX_IMAGE_INVALID',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND'
    ].includes(code) || Number(err?.status || 0) >= 500;
}

function retryDelayMs(err, attempt, config) {
    const rateLimited = String(err?.code || '') === 'VERTEX_QUOTA' || Number(err?.status || 0) === 429;
    const base = rateLimited ? Math.max(2500, config.retryBaseMs * 2) : config.retryBaseMs;
    return Math.min(30000, base * Math.pow(2, Math.max(0, attempt)));
}

function rateLimitDetail() {
    return 'Vertex AI is temporarily rate-limited. The image request will retry automatically.';
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

function assignRasterVisual(slide, path, promptInfo) {
    slide.rasterVisualAsset = path;
    slide.visualAsset = path;
    slide.mobileVisualAsset = path;
    slide.visualSource = 'ai_raster';
    slide.visualAssetType = 'image/webp';
    slide.imagePrompt = promptInfo.prompt;
    slide.imagePromptProvider = 'vertex_ai';
    slide.imagePromptModel = promptInfo.model;
    return slide;
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
                    stage: 'Retrying course image',
                    detail: `Retrying a temporary Vertex AI image failure (attempt ${attempt + 1} of ${attempts}).`
                });
            }
            const result = await generateVertexImage({
                prompt,
                model: config.imageModel,
                aspectRatio: '16:9'
            });
            checkCancelled();
            return {
                path,
                body: result.body,
                contentType: result.contentType || 'image/webp'
            };
        } catch (error) {
            if (isGenerationCancelled(error)) throw error;
            lastError = error;
            if (attempt >= attempts - 1 || !isRetryableImageError(error)) break;
            const delayMs = retryDelayMs(error, attempt, config);
            if (String(error?.code || '') === 'VERTEX_QUOTA' || Number(error?.status || 0) === 429) {
                emit(onProgress, { stage: 'Waiting for Vertex AI capacity', detail: rateLimitDetail() });
            }
            logger.warn('scorm_vertex_image_retry', {
                module: 'scorm',
                path,
                attempt: attempt + 1,
                nextAttempt: attempt + 2,
                delayMs,
                code: error.code || null,
                status: error.status || null,
                error: error.message
            });
            await sleep(delayMs);
        }
    }
    throw lastError || new Error('Vertex AI image generation failed.');
}

async function prepareReplicateCourseMedia(rawAnalysis, opts = {}) {
    const onProgress = opts.onProgress;
    const checkCancelled = typeof opts.checkCancelled === 'function' ? opts.checkCancelled : () => {};
    checkCancelled();

    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    const slides = Array.isArray(analysis.slides) ? analysis.slides.map(clearLegacyVisuals) : [];

    delete analysis.narrationAsset;
    delete analysis.narrationText;
    delete analysis.coverImageAsset;
    delete analysis.coverVisualAsset;
    delete analysis.coverMobileVisualAsset;

    analysis.visualMode = 'raster';
    analysis.visualProvider = 'vertex_ai';
    analysis.visualPromptProvider = 'vertex_ai';

    const config = mediaConfig();
    if (!config.enabled || !isVertexConfigured()) {
        emit(onProgress, {
            percent: 42,
            stage: 'Image generation unavailable',
            detail: 'Google Vertex AI image generation is not configured.'
        });
        const error = new Error('Vertex AI image generation is required. Configure GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_PROJECT and VERTEX_IMAGE_MODEL on the backend.');
        // Keep the legacy code for route compatibility until the route is renamed.
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
        percent: 38,
        stage: 'Generating course images with Vertex AI',
        detail: `Creating one 16:9 cover and up to ${selectedIndexes.length} slide visuals with ${config.imageModel}.`
    });

    try {
        checkCancelled();
        const coverPrompt = await generateCoverVisualPrompt({ ...analysis, slides });
        promptModel = promptModel || coverPrompt.model;
        analysis.coverImagePrompt = coverPrompt.prompt;
        analysis.coverImagePromptProvider = 'vertex_ai';
        analysis.coverImagePromptModel = coverPrompt.model;

        emit(onProgress, {
            percent: 40,
            stage: 'Generating course cover image',
            detail: 'Vertex AI is rendering the course cover in a wide 16:9 format.'
        });
        const coverPath = 'assets/media/course-cover.webp';
        const coverFile = await generateImage(coverPrompt.prompt, coverPath, config, onProgress, checkCancelled);
        files.push(coverFile);
        analysis.coverImageAsset = coverPath;
        analysis.coverVisualAsset = coverPath;
        analysis.coverMobileVisualAsset = coverPath;
        coverGenerated = true;
    } catch (error) {
        if (isGenerationCancelled(error)) throw error;
        warnings.push(`Cover image: ${error.message}`);
        logger.warn('scorm_vertex_course_cover_failed', {
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
            const basePercent = 44 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 24);
            emit(onProgress, {
                percent: basePercent,
                stage: `Generating slide ${slideIndex + 1} image`,
                detail: `Vertex AI is rendering a slide-specific 16:9 visual (${completedJobs + 1} of ${selectedIndexes.length}).`
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
            logger.warn('scorm_vertex_slide_image_failed', {
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
                detail: `${completedJobs} of ${selectedIndexes.length} slide image jobs completed.`
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
            detail: 'Vertex AI is retrying missing visual slots before packaging the course.'
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
                const file = await generateImage(promptInfo.prompt, path, config, onProgress, checkCancelled);
                files.push(file);
                assignRasterVisual(slides[slideIndex], path, promptInfo);
                successfulSlideIndexes.add(slideIndex);
                slideImagesGenerated += 1;
            } catch (error) {
                if (isGenerationCancelled(error)) throw error;
                warnings.push(`Recovery slide ${slideIndex + 1}: ${error.message}`);
                logger.warn('scorm_vertex_slide_image_recovery_failed', {
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
        const error = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required.${reason ? ` Vertex AI reported: ${reason}` : ''}`);
        error.code = 'REPLICATE_IMAGES_INCOMPLETE';
        error.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: error.message });
        throw error;
    }

    const totalImagesGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
    const estimatedUnit = Number.isFinite(config.imageUnitUsd) ? config.imageUnitUsd : IMAGE_UNIT_USD;
    const mediaMetadata = {
        provider: 'vertex_ai',
        imageModel: config.imageModel,
        visualPromptProvider: 'vertex_ai',
        visualPromptModel: promptModel,
        estimatedImageUnitUsd: estimatedUnit,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        estimatedImageCostUsd: Number((totalImagesGenerated * estimatedUnit).toFixed(4)),
        maxImages: config.maxImages,
        minImages: requiredImages,
        selectedSlideIndexes: selectedIndexes,
        successfulSlideIndexes: Array.from(successfulSlideIndexes).sort((a, b) => a - b),
        imageStyle: 'vertex_directed_simple_non_human_no_text',
        canonicalVisualAssets: true,
        legacySvgFallback: false,
        audio: false,
        warnings
    };

    const updated = {
        ...analysis,
        slides,
        visualMode: 'raster',
        visualProvider: 'vertex_ai',
        visualPromptProvider: 'vertex_ai',
        mediaProvider: 'vertex_ai',
        vertexMedia: mediaMetadata,
        // Retain this alias temporarily because existing package/UI code may
        // still read replicateMedia metadata. Its provider field is explicit.
        replicateMedia: mediaMetadata
    };

    emit(onProgress, {
        percent: 76,
        stage: 'Course images ready',
        detail: `${totalImagesGenerated} Vertex AI images are attached to the course. Legacy SVG generation remains disabled.`
    });
    logger.info('scorm_vertex_raster_media_ready', {
        module: 'scorm',
        imageModel: config.imageModel,
        promptModel,
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated,
        requiredImages,
        files: files.length,
        warnings: warnings.length
    });

    return { analysis: updated, files, metadata: mediaMetadata };
}

function coverImagePrompt(analysis) {
    return coverInstruction(analysis).replace(/FLUX/gi, 'the image model');
}

function slideImagePrompt(slide, courseTitle) {
    return slideInstruction(slide, { title: courseTitle }, 0).replace(/FLUX/gi, 'the image model');
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
    DEFAULT_IMAGE_MODEL,
    IMAGE_UNIT_USD
};
