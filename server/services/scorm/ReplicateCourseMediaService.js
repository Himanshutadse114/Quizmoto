const logger = require('../../utils/logger');
const {
    hasReplicateToken,
    runReplicateModel,
    outputUrl,
    downloadReplicateAsset,
    predictionRequestsPerMinute
} = require('./ReplicateClient');

// User-selected production model: quick, simple course imagery.
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
        maxImages: clampInt(process.env.REPLICATE_SCORM_MAX_IMAGES, 8, 1, 8),
        minImages: clampInt(process.env.REPLICATE_SCORM_MIN_IMAGES, 6, 1, 8),
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

function noHumanNoTextRules() {
    return [
        'NON-HUMAN VISUAL ONLY: do not show people, faces, hands, bodies, silhouettes, portraits, avatars or human figures.',
        'ABSOLUTELY NO TEXT IN THE IMAGE: no words, letters, numbers, captions, labels, logos, brand names, watermarks, readable screens, signs or typography.',
        'Use only simple objects, devices, interface-like shapes without readable text, security symbols and environmental objects.',
        'Keep the composition clean, uncluttered and easy to understand at course-slide size.'
    ].join(' ');
}

function coverImagePrompt(analysis) {
    const title = clean(analysis?.title) || 'professional digital security learning';
    const summary = sentenceExcerpt(analysis?.summary, 260);
    return [
        'Wide 16:9 simple premium object-based training-course image.',
        `Course subject: ${title}.`,
        summary ? `Course context: ${summary}` : '',
        'Create one clear symbolic scene that communicates the course subject using relevant objects only. Examples when appropriate: laptop, phone, envelope, lock, shield, browser window shapes, document, QR code shape, warning symbol, network nodes or office desk objects.',
        'Modern minimal corporate style, realistic or soft 3D objects, subtle teal accents, dark-neutral background, strong focal point, generous negative space.',
        noHumanNoTextRules()
    ].filter(Boolean).join(' ');
}

function slideImagePrompt(slide, courseTitle) {
    const title = clean(slide?.title) || 'learning concept';
    const content = sentenceExcerpt(slide?.content || slide?.introText || slide?.revealText, 420);
    const visual = clean(slide?.visualTitle);
    const query = clean(slide?.imageQuery);
    const points = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : []).slice(0, 4).map(clean).filter(Boolean).join('; ');
    return [
        'Wide 16:9 simple non-human visual for a professional digital learning slide.',
        `Course: ${clean(courseTitle)}.`,
        `Slide topic: ${title}.`,
        content ? `What this slide teaches: ${content}` : '',
        visual ? `Visual emphasis: ${visual}.` : '',
        query ? `Useful scene cues: ${query}.` : '',
        points ? `Key ideas to represent visually: ${points}.` : '',
        'Choose 2 to 5 physical or digital objects that directly represent THIS slide, not a generic cybersecurity background. Use object relationships to show the idea clearly.',
        'Examples: suspicious email -> envelope plus warning symbol; credential safety -> lock plus login-screen shape; QR phishing -> phone plus QR pattern plus warning symbol; reporting -> inbox/tray plus alert symbol; verification -> document plus check/shield; malware -> file icon plus lock/warning.',
        'Simple realistic or soft 3D object composition, professional training aesthetic, subtle teal accents, clean background, no decorative clutter.',
        noHumanNoTextRules()
    ].filter(Boolean).join(' ');
}

function recoverySlideImagePrompt(slide, courseTitle) {
    const title = clean(slide?.title) || 'safe digital behaviour';
    const content = sentenceExcerpt(slide?.content || slide?.introText, 240);
    return [
        'Wide 16:9 simple non-human corporate training visual.',
        `Course: ${clean(courseTitle)}.`,
        `Slide topic: ${title}.`,
        content ? `Lesson meaning: ${content}` : '',
        'Represent the lesson with only a few relevant objects such as a laptop, phone, envelope, document, lock, shield, warning symbol, browser panel or network nodes. Use the objects that best match the slide topic.',
        'Minimal realistic or soft 3D style, strong focal point, clean neutral background, subtle teal accent.',
        noHumanNoTextRules()
    ].filter(Boolean).join(' ');
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
            logger.warn('scorm_replicate_image_retry', { module: 'scorm', path, attempt: attempt + 1, nextAttempt: attempt + 2, delayMs, code: err.code, status: err.status || null, error: err.message });
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

async function prepareReplicateCourseMedia(rawAnalysis, opts = {}) {
    const onProgress = opts.onProgress;
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    const slides = Array.isArray(analysis.slides)
        ? analysis.slides.map((slide) => {
            const next = { ...(slide || {}) };
            delete next.narrationAsset;
            delete next.narrationText;
            delete next.rasterVisualAsset;
            return next;
        })
        : [];
    delete analysis.narrationAsset;
    delete analysis.narrationText;
    delete analysis.coverImageAsset;

    const config = mediaConfig();
    if (!config.enabled || !hasReplicateToken()) {
        emit(onProgress, { percent: 42, stage: 'Image generation unavailable', detail: 'Replicate image generation is not configured.' });
        const err = new Error('Replicate image generation is required. Configure REPLICATE_API_TOKEN and keep REPLICATE_SCORM_MEDIA enabled.');
        err.code = 'REPLICATE_IMAGES_REQUIRED';
        throw err;
    }

    const files = [];
    const warnings = [];
    const successfulSlideIndexes = new Set();
    let coverGenerated = false;
    let slideImagesGenerated = 0;

    const selectedIndexes = imageSlideIndexes(slides, Math.min(Math.max(0, config.maxImages - 1), slides.length));
    const availableImageSlots = 1 + selectedIndexes.length;
    const requiredImages = Math.min(availableImageSlots, config.maxImages, config.minImages);
    const requiredSlideImages = Math.max(0, requiredImages - 1);

    emit(onProgress, {
        percent: 8,
        stage: 'Creating course cover image',
        detail: `Generating the cover plus up to ${selectedIndexes.length} simple non-human slide visuals with FLUX Schnell. Requests are paced to ${predictionRequestsPerMinute()} per minute.`
    });

    try {
        const coverPath = 'assets/media/course-cover.webp';
        const coverFile = await generateImage(coverImagePrompt(analysis), coverPath, config, (state) => {
            const status = String(state?.status || '').toLowerCase();
            if (status === 'rate_limit_wait') emit(onProgress, { percent: 9, stage: 'Waiting for Replicate rate-limit slot', detail: rateLimitDetail(state), modelStatus: status });
            if (status === 'starting') emit(onProgress, { percent: 10, stage: 'Starting cover image', detail: 'FLUX Schnell accepted the cover request.', modelStatus: status, predictionId: state.predictionId || '' });
            if (status === 'processing') emit(onProgress, { percent: 16, stage: 'Generating course cover image', detail: 'Creating a simple object-only cover image with no text.', modelStatus: status, predictionId: state.predictionId || '' });
            if (status === 'retrying') emit(onProgress, { percent: 12, stage: 'Retrying course cover image', detail: 'Retrying the cover request after a temporary image-service issue.' });
        });
        files.push(coverFile);
        analysis.coverImageAsset = coverPath;
        coverGenerated = true;
    } catch (err) {
        warnings.push(`Cover image: ${err.message}`);
        logger.warn('scorm_replicate_cover_failed', { module: 'scorm', error: err.message, code: err.code, status: err.status || null });
    }

    let completedJobs = 0;
    for (const slideIndex of selectedIndexes) {
        const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
        try {
            const file = await generateImage(slideImagePrompt(slides[slideIndex], analysis.title), path, config, (state) => {
                const status = String(state?.status || '').toLowerCase();
                if (status === 'rate_limit_wait') emit(onProgress, {
                    percent: 30 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 34),
                    stage: `Waiting to generate slide ${slideIndex + 1} image`,
                    detail: rateLimitDetail(state),
                    modelStatus: status
                });
                if (status === 'retrying') emit(onProgress, {
                    percent: 30 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 34),
                    stage: `Retrying slide ${slideIndex + 1} image`,
                    detail: 'Retrying this slide image after a temporary Replicate failure.'
                });
            });
            files.push(file);
            slides[slideIndex].rasterVisualAsset = path;
            successfulSlideIndexes.add(slideIndex);
            slideImagesGenerated += 1;
        } catch (err) {
            warnings.push(`Slide ${slideIndex + 1} image: ${err.message}`);
            logger.warn('scorm_replicate_slide_image_failed', { module: 'scorm', slideIndex, error: err.message, code: err.code, status: err.status || null });
        } finally {
            completedJobs += 1;
            emit(onProgress, {
                percent: 30 + Math.round((completedJobs / Math.max(1, selectedIndexes.length)) * 34),
                stage: 'Generating learning-slide images',
                detail: `${completedJobs} of ${selectedIndexes.length} slide image jobs completed.`
            });
        }
    }

    if (coverGenerated && slideImagesGenerated < requiredSlideImages) {
        const recoveryCandidates = [
            ...selectedIndexes.filter((index) => !successfulSlideIndexes.has(index)),
            ...slides.map((_, index) => index).filter((index) => !successfulSlideIndexes.has(index) && !selectedIndexes.includes(index))
        ];
        emit(onProgress, { percent: 65, stage: 'Recovering missing course images', detail: 'Retrying missing visuals with a simpler object-only prompt.' });
        for (const slideIndex of recoveryCandidates) {
            if (slideImagesGenerated >= requiredSlideImages) break;
            const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
            try {
                const file = await generateImage(recoverySlideImagePrompt(slides[slideIndex], analysis.title), path, config, (state) => {
                    if (String(state?.status || '').toLowerCase() === 'rate_limit_wait') emit(onProgress, { percent: 66, stage: `Waiting to recover slide ${slideIndex + 1} image`, detail: rateLimitDetail(state), modelStatus: 'rate_limit_wait' });
                });
                files.push(file);
                slides[slideIndex].rasterVisualAsset = path;
                successfulSlideIndexes.add(slideIndex);
                slideImagesGenerated += 1;
            } catch (err) {
                warnings.push(`Recovery slide ${slideIndex + 1}: ${err.message}`);
                logger.warn('scorm_replicate_slide_image_recovery_failed', { module: 'scorm', slideIndex, error: err.message, code: err.code, status: err.status || null });
            }
        }
    }

    if (!coverGenerated || slideImagesGenerated < requiredSlideImages) {
        const totalGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
        const reason = warningSummary(warnings);
        const err = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required.${reason ? ` Replicate reported: ${reason}` : ''}`);
        err.code = 'REPLICATE_IMAGES_INCOMPLETE';
        err.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: err.message });
        throw err;
    }

    const totalImagesGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
    const updated = {
        ...analysis,
        slides,
        mediaProvider: 'replicate',
        replicateMedia: {
            imageModel: config.imageModel,
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
            imageStyle: 'simple_non_human_no_text',
            audio: false,
            warnings
        }
    };

    emit(onProgress, { percent: 76, stage: 'Images ready', detail: `${totalImagesGenerated} simple non-human raster images are ready. Building the SCORM package next.` });
    logger.info('scorm_replicate_media_ready', {
        module: 'scorm', imageModel: config.imageModel, coverGenerated, slideImagesGenerated, totalImagesGenerated,
        requiredImages, predictionRequestsPerMinute: predictionRequestsPerMinute(), files: files.length, warnings: warnings.length
    });

    return { analysis: updated, files, metadata: updated.replicateMedia };
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
    DEFAULT_IMAGE_MODEL,
    IMAGE_UNIT_USD
};
