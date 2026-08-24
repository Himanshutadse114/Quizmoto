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
    predictionRequestsPerMinute,
    predictionSpacingMs,
    parseRetryAfterMs
} = require('../services/scorm/ReplicateClient');
const {
    buildEmbeddedMediaMap,
    injectReplicateMediaUi
} = require('../services/scorm/ScormReplicateMediaFinalizer');

describe('SCORM Replicate image generation', () => {
    it('uses the requested FLUX Schnell model and keeps one-megapixel output by default', () => {
        const previous = process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS;
        delete process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS;
        try {
            const config = mediaConfig();
            expect(DEFAULT_IMAGE_MODEL).to.equal('black-forest-labs/flux-schnell');
            expect(config.imageModel).to.equal(DEFAULT_IMAGE_MODEL);
            expect(config.imageMegapixels).to.equal('1');
            expect(IMAGE_UNIT_USD).to.equal(0.003);
        } finally {
            if (previous == null) delete process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS;
            else process.env.REPLICATE_SCORM_IMAGE_MEGAPIXELS = previous;
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
        const recovery = recoverySlideImagePrompt({ title: 'Report suspicious messages', content: 'Report suspicious messages through the approved channel.' }, 'Phishing Awareness');
        for (const prompt of [cover, recovery]) {
            expect(prompt).to.include('NON-HUMAN VISUAL ONLY');
            expect(prompt).to.include('ABSOLUTELY NO TEXT IN THE IMAGE');
        }
    });

    it('defaults prediction creation to six requests per minute with safe rolling-window spacing', () => {
        const previous = process.env.REPLICATE_PREDICTIONS_PER_MINUTE;
        delete process.env.REPLICATE_PREDICTIONS_PER_MINUTE;
        try {
            expect(predictionRequestsPerMinute()).to.equal(6);
            expect(predictionSpacingMs()).to.be.at.least(10250);
        } finally {
            if (previous == null) delete process.env.REPLICATE_PREDICTIONS_PER_MINUTE;
            else process.env.REPLICATE_PREDICTIONS_PER_MINUTE = previous;
        }
    });

    it('allows an explicitly lower Replicate prediction limit but never drops below one request per minute', () => {
        const previous = process.env.REPLICATE_PREDICTIONS_PER_MINUTE;
        try {
            process.env.REPLICATE_PREDICTIONS_PER_MINUTE = '4';
            expect(predictionRequestsPerMinute()).to.equal(4);
            expect(predictionSpacingMs()).to.be.at.least(15250);
            process.env.REPLICATE_PREDICTIONS_PER_MINUTE = '0';
            expect(predictionRequestsPerMinute()).to.equal(1);
        } finally {
            if (previous == null) delete process.env.REPLICATE_PREDICTIONS_PER_MINUTE;
            else process.env.REPLICATE_PREDICTIONS_PER_MINUTE = previous;
        }
    });

    it('extracts Replicate reset time from a 429 response detail', () => {
        const response = { headers: { get: () => '' } };
        expect(parseRetryAfterMs(response, { detail: 'Request was throttled. Your rate limit resets in ~30s.' })).to.equal(30000);
        expect(parseRetryAfterMs(response, { detail: 'Request was throttled. Expected available in 1 second.' })).to.equal(1000);
    });

    it('treats rate limits, transient server errors and incomplete image downloads as retryable', () => {
        expect(isRetryableImageError({ code: 'REPLICATE_RATE_LIMIT' })).to.equal(true);
        expect(isRetryableImageError({ code: 'REPLICATE_API_ERROR', status: 503 })).to.equal(true);
        expect(isRetryableImageError({ code: 'REPLICATE_API_ERROR', status: 400 })).to.equal(false);
        expect(isRetryableImageError({ code: 'REPLICATE_MEDIA_DOWNLOAD' })).to.equal(true);
    });

    it('respects Replicate reset timing when rate limited', () => {
        const config = { retryBaseMs: 1400 };
        expect(retryDelayMs({ code: 'REPLICATE_RATE_LIMIT', retryAfterMs: 30000 }, 0, config)).to.be.at.least(30500);
        expect(retryDelayMs({ code: 'REPLICATE_NETWORK' }, 1, config)).to.be.greaterThan(1400);
    });

    it('shows why an image request is intentionally waiting', () => {
        const detail = rateLimitDetail({ waitMs: 10250, rateLimitPerMinute: 6 });
        expect(detail).to.include('6 new prediction request(s) per minute');
        expect(detail).to.include('about 11s');
    });

    it('embeds packaged WebP bytes into the learner HTML as a data URI fallback', () => {
        const map = buildEmbeddedMediaMap([{ path: 'assets/media/slide-001.webp', body: Buffer.from('image-bytes'), contentType: 'image/webp' }]);
        expect(map['assets/media/slide-001.webp']).to.match(/^data:image\/webp;base64,/);
        const html = injectReplicateMediaUi('<html><head></head><body></body></html>', map);
        expect(html).to.include('quizmoto-replicate-media-script-v2');
        expect(html).to.include('data:image/webp;base64');
    });
});
