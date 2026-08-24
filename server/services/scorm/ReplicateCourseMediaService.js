const logger = require('../../utils/logger');
const {
    hasReplicateToken,
    runReplicateModel,
    outputUrl,
    downloadReplicateAsset
} = require('./ReplicateClient');

const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-schnell';

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
        imageModel: String(process.env.REPLICATE_SCORM_IMAGE_MODEL || DEFAULT_IMAGE_MODEL).trim(),
        maxImages: clampInt(process.env.REPLICATE_SCORM_MAX_IMAGES, 5, 1, 8),
        minImages: clampInt(process.env.REPLICATE_SCORM_MIN_IMAGES, 3, 1, 8),
        imageMegapixels: String(process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS || '1').trim(),
        imageQuality: clampInt(process.env.REPLICATE_SCORM_IMAGE_QUALITY, 82, 50, 100),
        imageRetries: clampInt(process.env.REPLICATE_SCORM_IMAGE_RETRIES, 1, 0, 2)
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
    return text.slice(0, maxChars).replace(/\s+\S*$/, '').replace(/[,:;\-]+$/, '').trim() + '…';
}

function imageSlideIndexes(slides, count) {
    const total = Array.isArray(slides) ? slides.length : 0;
    if (!total || count <= 0) return [];
    if (count >= total) return Array.from({ length: total }, (_, index) => index);

    // Space images across the whole learning journey rather than clustering them
    // near the beginning. This keeps a 10-14 slide course visually paced.
    const chosen = new Set();
    for (let slot = 0; slot < count; slot += 1) {
        const index = count === 1
            ? Math.floor(total / 2)
            : Math.round((slot * (total - 1)) / (count - 1));
        chosen.add(index);
    }
    for (let index = 0; chosen.size < count && index < total; index += 1) chosen.add(index);
    return Array.from(chosen).sort((a, b) => a - b);
}

function coverImagePrompt(analysis) {
    const title = clean(analysis?.title) || 'professional workplace learning';
    const summary = sentenceExcerpt(analysis?.summary, 300);
    return [
        'Wide 16:9 premium editorial training-course hero photograph.',
        `Subject: ${title}.`,
        summary ? `Context: ${summary}` : '',
        'Create one clear believable workplace scene that communicates the subject immediately. Real people and realistic objects, modern corporate environment, natural lighting, sophisticated depth, subtle teal accents, premium learning-course photography, clean composition and useful negative space.',
        'No words, no captions, no logos, no readable screens, no watermarks, no infographic, no vector art, no illustration, no UI mockup.'
    ].filter(Boolean).join(' ');
}

function slideImagePrompt(slide, courseTitle) {
    const title = clean(slide?.title);
    const visual = clean(slide?.visualTitle);
    const query = clean(slide?.imageQuery);
    const points = (Array.isArray(slide?.keyPoints) ? slide.keyPoints : []).slice(0, 4).map(clean).filter(Boolean).join(', ');
    return [
        'Wide 16:9 realistic editorial photograph for a professional digital learning course.',
        `Course: ${clean(courseTitle)}.`,
        title ? `Lesson: ${title}.` : '',
        visual ? `Visual focus: ${visual}.` : '',
        query ? `Scene cues: ${query}.` : '',
        points ? `Important ideas to represent visually: ${points}.` : '',
        'Show one specific, believable workplace moment rather than a generic cyber background. Use natural human expressions, credible devices or office objects, premium corporate-training photography, subtle teal accents and a strong focal point.',
        'No words, no captions, no logos, no readable screen text, no watermarks, no infographic, no vector art, no illustration.'
    ].filter(Boolean).join(' ');
}

function isRetryableImageError(err) {
    return [
        'REPLICATE_NETWORK',
        'REPLICATE_TIMEOUT',
        'REPLICATE_PREDICTION_FAILED',
        'REPLICATE_MEDIA_DOWNLOAD',
        'REPLICATE_IMAGE_EMPTY'
    ].includes(String(err?.code || ''));
}

async function generateImage(prompt, path, config, onStatus) {
    let lastError = null;
    const attempts = 1 + config.imageRetries;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            if (attempt > 0 && typeof onStatus === 'function') {
                onStatus({ status: 'retrying', attempt: attempt + 1 });
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
            const url = outputUrl(output);
            if (!url) {
                const err = new Error('Replicate image model returned no output URL.');
                err.code = 'REPLICATE_IMAGE_EMPTY';
                throw err;
            }
            return { path, body: await downloadReplicateAsset(url), contentType: 'image/webp' };
        } catch (err) {
            lastError = err;
            if (attempt >= attempts - 1 || !isRetryableImageError(err)) break;
            await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
        }
    }
    throw lastError || new Error('Replicate image generation failed.');
}

async function mapLimit(items, limit, worker) {
    const list = Array.from(items || []);
    const results = new Array(list.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.max(1, Math.min(limit, list.length || 1)) }, async () => {
        while (cursor < list.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(list[index], index);
        }
    });
    await Promise.all(runners);
    return results;
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
        const err = new Error('Replicate image generation is required for AI-authored courses. Configure REPLICATE_API_TOKEN and keep REPLICATE_SCORM_MEDIA enabled.');
        err.code = 'REPLICATE_IMAGES_REQUIRED';
        throw err;
    }

    const files = [];
    const warnings = [];
    let coverGenerated = false;
    let slideImagesGenerated = 0;

    const slideImageCount = Math.max(0, config.maxImages - 1);
    const selectedIndexes = imageSlideIndexes(slides, Math.min(slideImageCount, slides.length));
    const availableImageSlots = 1 + selectedIndexes.length;
    const requiredImages = Math.min(availableImageSlots, config.maxImages, config.minImages);
    const requiredSlideImages = Math.max(0, requiredImages - 1);

    emit(onProgress, {
        percent: 8,
        stage: 'Creating course cover image',
        detail: `Generating the front image plus up to ${selectedIndexes.length} learning-slide images. No audio is generated.`
    });

    try {
        const coverPath = 'assets/media/course-cover.webp';
        const coverFile = await generateImage(coverImagePrompt(analysis), coverPath, config, (state) => {
            const status = String(state?.status || '').toLowerCase();
            if (status === 'starting') emit(onProgress, { percent: 10, stage: 'Waiting for Replicate image model', detail: 'Replicate accepted the cover request and is starting FLUX Schnell.', modelStatus: status, predictionId: state.predictionId || '' });
            if (status === 'processing') emit(onProgress, { percent: 16, stage: 'Generating course cover image', detail: 'FLUX Schnell is actively creating the front-slide image.', modelStatus: status, predictionId: state.predictionId || '' });
            if (status === 'retrying') emit(onProgress, { percent: 12, stage: 'Retrying course cover image', detail: 'The first image attempt did not complete cleanly. Retrying once.' });
            if (status === 'succeeded') emit(onProgress, { percent: 24, stage: 'Course cover image ready', detail: 'The front-slide image has been generated.', modelStatus: status, predictionId: state.predictionId || '' });
        });
        files.push(coverFile);
        analysis.coverImageAsset = coverPath;
        coverGenerated = true;
    } catch (err) {
        warnings.push(`Cover image: ${err.message}`);
        logger.warn('scorm_replicate_cover_failed', { module: 'scorm', error: err.message, code: err.code });
    }

    emit(onProgress, { percent: 30, stage: 'Generating learning-slide images', detail: `Creating up to ${selectedIndexes.length} topic-relevant slide images.` });
    let completedJobs = 0;
    const imageResults = await mapLimit(selectedIndexes, 2, async (slideIndex) => {
        const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
        try {
            const file = await generateImage(slideImagePrompt(slides[slideIndex], analysis.title), path, config);
            return { slideIndex, file, path };
        } catch (err) {
            warnings.push(`Slide ${slideIndex + 1} image: ${err.message}`);
            logger.warn('scorm_replicate_slide_image_failed', { module: 'scorm', slideIndex, error: err.message, code: err.code });
            return null;
        } finally {
            completedJobs += 1;
            const fraction = selectedIndexes.length ? completedJobs / selectedIndexes.length : 1;
            emit(onProgress, {
                percent: 30 + Math.round(fraction * 42),
                stage: 'Generating learning-slide images',
                detail: `${completedJobs} of ${selectedIndexes.length} learning-slide image jobs completed.`
            });
        }
    });

    for (const result of imageResults.filter(Boolean)) {
        files.push(result.file);
        slides[result.slideIndex].rasterVisualAsset = result.path;
        slideImagesGenerated += 1;
    }

    if (!coverGenerated || slideImagesGenerated < requiredSlideImages) {
        const totalGenerated = (coverGenerated ? 1 : 0) + slideImagesGenerated;
        const err = new Error(`Course image generation was incomplete. Generated ${totalGenerated} image(s), but at least ${requiredImages} including the front cover are required. Please retry generation.`);
        err.code = 'REPLICATE_IMAGES_INCOMPLETE';
        err.imageWarnings = warnings;
        emit(onProgress, { percent: 72, stage: 'Image generation incomplete', detail: err.message });
        throw err;
    }

    const updated = {
        ...analysis,
        slides,
        mediaProvider: 'replicate',
        replicateMedia: {
            imageModel: config.imageModel,
            coverGenerated,
            slideImagesGenerated,
            totalImagesGenerated: 1 + slideImagesGenerated,
            maxImages: config.maxImages,
            minImages: requiredImages,
            selectedSlideIndexes: selectedIndexes,
            audio: false,
            warnings
        }
    };

    emit(onProgress, { percent: 76, stage: 'Images ready', detail: `${1 + slideImagesGenerated} raster images are ready. Formatting and packaging the SCORM course next.` });
    logger.info('scorm_replicate_media_ready', {
        module: 'scorm',
        coverGenerated,
        slideImagesGenerated,
        totalImagesGenerated: 1 + slideImagesGenerated,
        requiredImages,
        audio: false,
        files: files.length,
        warnings: warnings.length
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
    isRetryableImageError,
    DEFAULT_IMAGE_MODEL
};
