const logger = require('../../utils/logger');
const {
    hasReplicateToken,
    runReplicateModel,
    outputUrl,
    downloadReplicateAsset
} = require('./ReplicateClient');

const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux-schnell';
const DEFAULT_TTS_MODEL = 'qwen/qwen3-tts';
const DEFAULT_TTS_SPEAKER = 'Serena';
const DEFAULT_TTS_STYLE = 'Warm, confident professional learning narrator. Natural conversational pacing, clear pronunciation, calm and engaging. Avoid a robotic or promotional announcer style. Use subtle emphasis on important learner actions.';

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
        ttsModel: String(process.env.REPLICATE_SCORM_TTS_MODEL || DEFAULT_TTS_MODEL).trim(),
        speaker: String(process.env.REPLICATE_SCORM_TTS_SPEAKER || DEFAULT_TTS_SPEAKER).trim(),
        ttsStyle: String(process.env.REPLICATE_SCORM_TTS_STYLE || DEFAULT_TTS_STYLE).trim(),
        maxImages: clampInt(process.env.REPLICATE_SCORM_MAX_IMAGES, 5, 1, 8),
        narrationCharBudget: clampInt(process.env.REPLICATE_SCORM_TTS_CHAR_BUDGET, 3200, 600, 7000),
        imageMegapixels: String(process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS || '1').trim(),
        imageQuality: clampInt(process.env.REPLICATE_SCORM_IMAGE_QUALITY, 82, 50, 100)
    };
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
    const chosen = new Set();
    for (let slot = 0; slot < count; slot += 1) {
        const index = count === 1 ? Math.floor(total / 2) : Math.round((slot * (total - 1)) / (count - 1));
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
        'Realistic modern workplace, believable people and objects, human-centred composition, professional corporate learning aesthetic, natural lighting, sophisticated depth, subtle teal accents, clean negative space.',
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
        'Use a credible workplace setting and a clear single visual idea. Natural human expressions, modern office details, premium training aesthetic, subtle teal accents, strong composition.',
        'No words, no captions, no logos, no readable screen text, no watermarks, no infographic, no vector art, no illustration.'
    ].filter(Boolean).join(' ');
}

async function generateImage(prompt, path, config) {
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
    }, { timeoutMs: Number(process.env.REPLICATE_SCORM_IMAGE_TIMEOUT_MS || 180000) });
    const url = outputUrl(output);
    if (!url) {
        const err = new Error('Replicate image model returned no output URL.');
        err.code = 'REPLICATE_IMAGE_EMPTY';
        throw err;
    }
    return { path, body: await downloadReplicateAsset(url), contentType: 'image/webp' };
}

async function generateNarration(text, path, config) {
    const output = await runReplicateModel(config.ttsModel, {
        mode: 'custom_voice',
        text,
        speaker: config.speaker,
        language: 'auto',
        style_instruction: config.ttsStyle
    }, { timeoutMs: Number(process.env.REPLICATE_SCORM_TTS_TIMEOUT_MS || 180000) });
    const url = outputUrl(output);
    if (!url) {
        const err = new Error('Replicate TTS model returned no output URL.');
        err.code = 'REPLICATE_TTS_EMPTY';
        throw err;
    }
    return { path, body: await downloadReplicateAsset(url), contentType: 'audio/wav' };
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

async function prepareReplicateCourseMedia(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? rawAnalysis : {};
    const slides = Array.isArray(analysis.slides) ? analysis.slides.map((slide) => ({ ...(slide || {}) })) : [];
    const config = mediaConfig();
    if (!config.enabled || !hasReplicateToken()) {
        return { analysis: { ...analysis, slides }, files: [], metadata: { enabled: false } };
    }

    const files = [];
    const warnings = [];
    let coverGenerated = false;
    let slideImagesGenerated = 0;
    let narrationChars = 0;

    // The cost guard counts the cover as one image. Remaining image slots are
    // distributed across the course instead of generating an image per screen.
    const slideImageCount = Math.max(0, config.maxImages - 1);
    const selectedIndexes = imageSlideIndexes(slides, Math.min(slideImageCount, slides.length));

    try {
        const coverPath = 'assets/media/course-cover.webp';
        const coverFile = await generateImage(coverImagePrompt(analysis), coverPath, config);
        files.push(coverFile);
        analysis.coverImageAsset = coverPath;
        coverGenerated = true;
    } catch (err) {
        warnings.push(`Cover image: ${err.message}`);
        logger.warn('scorm_replicate_cover_failed', { module: 'scorm', error: err.message, code: err.code });
    }

    const imageResults = await mapLimit(selectedIndexes, 3, async (slideIndex) => {
        const path = `assets/media/slide-${String(slideIndex + 1).padStart(3, '0')}.webp`;
        try {
            const file = await generateImage(slideImagePrompt(slides[slideIndex], analysis.title), path, config);
            return { slideIndex, file, path };
        } catch (err) {
            warnings.push(`Slide ${slideIndex + 1} image: ${err.message}`);
            logger.warn('scorm_replicate_slide_image_failed', { module: 'scorm', slideIndex, error: err.message, code: err.code });
            return null;
        }
    });
    for (const result of imageResults.filter(Boolean)) {
        files.push(result.file);
        slides[result.slideIndex].rasterVisualAsset = result.path;
        slideImagesGenerated += 1;
    }

    const perSlideBudget = slides.length ? Math.max(140, Math.floor(config.narrationCharBudget / slides.length)) : 0;
    const narrationJobs = [];
    let remainingChars = config.narrationCharBudget;
    slides.forEach((slide, index) => {
        if (remainingChars <= 0) return;
        const allowed = Math.min(perSlideBudget, remainingChars);
        const narration = sentenceExcerpt(slide.narrationText || slide.introText || slide.content, allowed);
        if (narration.length < 40) return;
        remainingChars -= narration.length;
        narrationChars += narration.length;
        slide.narrationText = narration;
        narrationJobs.push({ index, narration, path: `assets/media/narration-${String(index + 1).padStart(3, '0')}.wav` });
    });

    const narrationResults = await mapLimit(narrationJobs, 3, async (job) => {
        try {
            const file = await generateNarration(job.narration, job.path, config);
            return { ...job, file };
        } catch (err) {
            warnings.push(`Slide ${job.index + 1} narration: ${err.message}`);
            logger.warn('scorm_replicate_tts_failed', { module: 'scorm', slideIndex: job.index, error: err.message, code: err.code });
            return null;
        }
    });
    for (const result of narrationResults.filter(Boolean)) {
        files.push(result.file);
        slides[result.index].narrationAsset = result.path;
    }

    const updated = {
        ...analysis,
        slides,
        mediaProvider: 'replicate',
        replicateMedia: {
            imageModel: config.imageModel,
            ttsModel: config.ttsModel,
            ttsSpeaker: config.speaker,
            coverGenerated,
            slideImagesGenerated,
            narrationSlidesGenerated: narrationResults.filter(Boolean).length,
            narrationChars,
            maxImages: config.maxImages,
            narrationCharBudget: config.narrationCharBudget,
            warnings
        }
    };

    logger.info('scorm_replicate_media_ready', {
        module: 'scorm',
        coverGenerated,
        slideImagesGenerated,
        narrationSlidesGenerated: narrationResults.filter(Boolean).length,
        narrationChars,
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
    DEFAULT_IMAGE_MODEL,
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_SPEAKER,
    DEFAULT_TTS_STYLE
};
