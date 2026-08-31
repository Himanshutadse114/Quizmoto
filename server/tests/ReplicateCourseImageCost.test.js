const { expect } = require('chai');
const {
    mediaConfig,
    DEFAULT_IMAGE_MODEL,
    IMAGE_UNIT_USD,
    isRetryableImageError,
    retryDelayMs,
    coverImagePrompt,
    slideImagePrompt,
    recoverySlideImagePrompt,
    rateLimitDetail
} = require('../services/scorm/ReplicateCourseMediaService');
const {
    buildEmbeddedMediaMap,
    injectReplicateMediaUi
} = require('../services/scorm/ScormReplicateMediaFinalizer');

describe('SCORM fal.ai FLUX Schnell image generation', () => {
    it('uses fal.ai FLUX Schnell at about one megapixel by default', () => {
        const keys = [
            'FAL_IMAGE_MODEL', 'FAL_IMAGE_UNIT_USD', 'FAL_SCORM_IMAGE_WIDTH',
            'FAL_SCORM_IMAGE_HEIGHT', 'FAL_SCORM_OUTPUT_FORMAT', 'FAL_SCORM_ACCELERATION'
        ];
        const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
        keys.forEach((key) => delete process.env[key]);
        try {
            const config = mediaConfig();
            expect(DEFAULT_IMAGE_MODEL).to.equal('fal-ai/flux/schnell');
            expect(config.imageModel).to.equal(DEFAULT_IMAGE_MODEL);
            expect(IMAGE_UNIT_USD).to.equal(0.003);
            expect(config.imageUnitUsd).to.equal(0.003);
            expect(config.width).to.equal(1280);
            expect(config.height).to.equal(720);
            expect(config.outputFormat).to.equal('jpeg');
            expect(config.acceleration).to.equal('regular');
            expect(config.numInferenceSteps).to.equal(4);
        } finally {
            for (const key of keys) {
                if (previous[key] == null) delete process.env[key];
                else process.env[key] = previous[key];
            }
        }
    });

    it('allows fal.ai image settings to be changed without a deployment', () => {
        const previousModel = process.env.FAL_IMAGE_MODEL;
        const previousUnit = process.env.FAL_IMAGE_UNIT_USD;
        try {
            process.env.FAL_IMAGE_MODEL = 'fal-ai/flux/schnell';
            process.env.FAL_IMAGE_UNIT_USD = '0.004';
            const config = mediaConfig();
            expect(config.imageModel).to.equal('fal-ai/flux/schnell');
            expect(config.imageUnitUsd).to.equal(0.004);
        } finally {
            if (previousModel == null) delete process.env.FAL_IMAGE_MODEL;
            else process.env.FAL_IMAGE_MODEL = previousModel;
            if (previousUnit == null) delete process.env.FAL_IMAGE_UNIT_USD;
            else process.env.FAL_IMAGE_UNIT_USD = previousUnit;
        }
    });

    it('creates slide-grounded FLUX prompts that explicitly forbid people and text', () => {
        const prompt = slideImagePrompt({
            title: 'Verify suspicious payment requests',
            content: 'Unexpected payment requests should be verified using an official contact channel before any transfer is made.',
            keyPoints: ['Check the sender', 'Use an official channel']
        }, 'Social Engineering Awareness');
        expect(prompt).to.include('Slide topic: Verify suspicious payment requests');
        expect(prompt).to.include('What this slide teaches');
        expect(prompt).to.include('NON-HUMAN VISUAL ONLY');
        expect(prompt).to.include('do not show people');
        expect(prompt).to.include('ABSOLUTELY NO TEXT IN THE IMAGE');
    });

    it('keeps cover and recovery prompts non-human and text-free', () => {
        const cover = coverImagePrompt({ title: 'Phishing Awareness', summary: 'Recognise suspicious requests and verify them safely.' });
        const recovery = recoverySlideImagePrompt({
            title: 'Report suspicious messages',
            content: 'Report suspicious messages through the approved channel.'
        }, 'Phishing Awareness');
        for (const prompt of [cover, recovery]) {
            expect(prompt).to.include('NON-HUMAN VISUAL ONLY');
            expect(prompt).to.include('ABSOLUTELY NO TEXT IN THE IMAGE');
        }
    });

    it('uses an image-rich default budget with a six-image minimum quality gate', () => {
        const previousMax = process.env.FAL_SCORM_MAX_IMAGES;
        const previousMin = process.env.FAL_SCORM_MIN_IMAGES;
        const previousVertexMax = process.env.VERTEX_SCORM_MAX_IMAGES;
        const previousVertexMin = process.env.VERTEX_SCORM_MIN_IMAGES;
        delete process.env.FAL_SCORM_MAX_IMAGES;
        delete process.env.FAL_SCORM_MIN_IMAGES;
        delete process.env.VERTEX_SCORM_MAX_IMAGES;
        delete process.env.VERTEX_SCORM_MIN_IMAGES;
        try {
            const config = mediaConfig();
            expect(config.maxImages).to.equal(8);
            expect(config.minImages).to.equal(6);
        } finally {
            if (previousMax == null) delete process.env.FAL_SCORM_MAX_IMAGES;
            else process.env.FAL_SCORM_MAX_IMAGES = previousMax;
            if (previousMin == null) delete process.env.FAL_SCORM_MIN_IMAGES;
            else process.env.FAL_SCORM_MIN_IMAGES = previousMin;
            if (previousVertexMax == null) delete process.env.VERTEX_SCORM_MAX_IMAGES;
            else process.env.VERTEX_SCORM_MAX_IMAGES = previousVertexMax;
            if (previousVertexMin == null) delete process.env.VERTEX_SCORM_MIN_IMAGES;
            else process.env.VERTEX_SCORM_MIN_IMAGES = previousVertexMin;
        }
    });

    it('treats fal.ai concurrency, transient service errors and incomplete images as retryable', () => {
        expect(isRetryableImageError({ code: 'FAL_RATE_LIMIT', status: 429 })).to.equal(true);
        expect(isRetryableImageError({ code: 'FAL_UNAVAILABLE', status: 503 })).to.equal(true);
        expect(isRetryableImageError({ code: 'FAL_API_ERROR', status: 503 })).to.equal(true);
        expect(isRetryableImageError({ code: 'FAL_API_ERROR', status: 400 })).to.equal(false);
        expect(isRetryableImageError({ code: 'FAL_IMAGE_EMPTY' })).to.equal(true);
    });

    it('backs off more aggressively after a fal.ai rate-limit error', () => {
        const config = { retryBaseMs: 900 };
        expect(retryDelayMs({ code: 'FAL_RATE_LIMIT', status: 429 }, 0, config)).to.be.at.least(1800);
        expect(retryDelayMs({ code: 'FAL_UNAVAILABLE', status: 503 }, 1, config)).to.be.greaterThan(900);
    });

    it('shows why an image request is intentionally waiting', () => {
        expect(rateLimitDetail()).to.include('fal.ai');
        expect(rateLimitDetail()).to.include('retry');
    });

    it('keeps packaged JPEG bytes compatible with the existing learner HTML media injector', () => {
        const map = buildEmbeddedMediaMap([
            { path: 'assets/media/slide-001.jpg', body: Buffer.from('image-bytes'), contentType: 'image/jpeg' }
        ]);
        expect(map['assets/media/slide-001.jpg']).to.match(/^data:image\/jpeg;base64,/);
        const html = injectReplicateMediaUi('<html><head></head><body></body></html>', map);
        expect(html).to.include('quizmoto-replicate-media-script-v2');
        expect(html).to.include('data:image/jpeg;base64');
    });
});
