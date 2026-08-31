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

describe('SCORM Vertex AI image generation', () => {
    it('uses the configured Gemini image model and current 1K image cost estimate by default', () => {
        const previousModel = process.env.VERTEX_IMAGE_MODEL;
        const previousUnit = process.env.VERTEX_IMAGE_UNIT_USD;
        delete process.env.VERTEX_IMAGE_MODEL;
        delete process.env.VERTEX_IMAGE_UNIT_USD;
        try {
            const config = mediaConfig();
            expect(DEFAULT_IMAGE_MODEL).to.equal('gemini-3.1-flash-lite-image');
            expect(config.imageModel).to.equal(DEFAULT_IMAGE_MODEL);
            expect(IMAGE_UNIT_USD).to.equal(0.034);
            expect(config.imageUnitUsd).to.equal(0.034);
        } finally {
            if (previousModel == null) delete process.env.VERTEX_IMAGE_MODEL;
            else process.env.VERTEX_IMAGE_MODEL = previousModel;
            if (previousUnit == null) delete process.env.VERTEX_IMAGE_UNIT_USD;
            else process.env.VERTEX_IMAGE_UNIT_USD = previousUnit;
        }
    });

    it('allows the production image model and cost estimate to be changed without a code deployment', () => {
        const previousModel = process.env.VERTEX_IMAGE_MODEL;
        const previousUnit = process.env.VERTEX_IMAGE_UNIT_USD;
        try {
            process.env.VERTEX_IMAGE_MODEL = 'future-image-model';
            process.env.VERTEX_IMAGE_UNIT_USD = '0.02';
            const config = mediaConfig();
            expect(config.imageModel).to.equal('future-image-model');
            expect(config.imageUnitUsd).to.equal(0.02);
        } finally {
            if (previousModel == null) delete process.env.VERTEX_IMAGE_MODEL;
            else process.env.VERTEX_IMAGE_MODEL = previousModel;
            if (previousUnit == null) delete process.env.VERTEX_IMAGE_UNIT_USD;
            else process.env.VERTEX_IMAGE_UNIT_USD = previousUnit;
        }
    });

    it('creates slide-grounded prompts that explicitly forbid people and text', () => {
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

    it('keeps the cover and recovery prompts non-human and text-free too', () => {
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
        const previousMax = process.env.VERTEX_SCORM_MAX_IMAGES;
        const previousMin = process.env.VERTEX_SCORM_MIN_IMAGES;
        delete process.env.VERTEX_SCORM_MAX_IMAGES;
        delete process.env.VERTEX_SCORM_MIN_IMAGES;
        try {
            const config = mediaConfig();
            expect(config.maxImages).to.equal(8);
            expect(config.minImages).to.equal(6);
        } finally {
            if (previousMax == null) delete process.env.VERTEX_SCORM_MAX_IMAGES;
            else process.env.VERTEX_SCORM_MAX_IMAGES = previousMax;
            if (previousMin == null) delete process.env.VERTEX_SCORM_MIN_IMAGES;
            else process.env.VERTEX_SCORM_MIN_IMAGES = previousMin;
        }
    });

    it('treats Vertex quota, transient service errors and incomplete images as retryable', () => {
        expect(isRetryableImageError({ code: 'VERTEX_QUOTA' })).to.equal(true);
        expect(isRetryableImageError({ code: 'VERTEX_UNAVAILABLE', status: 503 })).to.equal(true);
        expect(isRetryableImageError({ code: 'VERTEX_API_ERROR', status: 503 })).to.equal(true);
        expect(isRetryableImageError({ code: 'VERTEX_API_ERROR', status: 400 })).to.equal(false);
        expect(isRetryableImageError({ code: 'VERTEX_IMAGE_EMPTY' })).to.equal(true);
    });

    it('backs off more aggressively after a Vertex quota error', () => {
        const config = { retryBaseMs: 1200 };
        expect(retryDelayMs({ code: 'VERTEX_QUOTA', status: 429 }, 0, config)).to.be.at.least(2500);
        expect(retryDelayMs({ code: 'VERTEX_UNAVAILABLE', status: 503 }, 1, config)).to.be.greaterThan(1200);
    });

    it('shows why an image request is intentionally waiting', () => {
        expect(rateLimitDetail()).to.include('Vertex AI');
        expect(rateLimitDetail()).to.include('retry');
    });

    it('keeps packaged WebP bytes compatible with the existing learner HTML media injector', () => {
        const map = buildEmbeddedMediaMap([
            { path: 'assets/media/slide-001.webp', body: Buffer.from('image-bytes'), contentType: 'image/webp' }
        ]);
        expect(map['assets/media/slide-001.webp']).to.match(/^data:image\/webp;base64,/);
        const html = injectReplicateMediaUi('<html><head></head><body></body></html>', map);
        expect(html).to.include('quizmoto-replicate-media-script-v2');
        expect(html).to.include('data:image/webp;base64');
    });
});
