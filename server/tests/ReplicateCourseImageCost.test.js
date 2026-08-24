const { expect } = require('chai');
const {
    mediaConfig,
    DEFAULT_IMAGE_MODEL,
    isRetryableImageError,
    retryDelayMs,
    recoverySlideImagePrompt,
    rateLimitDetail
} = require('../services/scorm/ReplicateCourseMediaService');
const {
    predictionRequestsPerMinute,
    predictionSpacingMs,
    parseRetryAfterMs
} = require('../services/scorm/ReplicateClient');

describe('SCORM low-cost Replicate image generation', () => {
    it('locks AI course artwork to FLUX.2 Klein 4B at 1 MP even if Render has an older model override', () => {
        const previous = process.env.REPLICATE_SCORM_IMAGE_MODEL;
        process.env.REPLICATE_SCORM_IMAGE_MODEL = 'minimax/image-01';
        try {
            const config = mediaConfig();
            expect(DEFAULT_IMAGE_MODEL).to.equal('black-forest-labs/flux-2-klein-4b');
            expect(config.imageModel).to.equal(DEFAULT_IMAGE_MODEL);
            expect(config.imageMegapixels).to.equal('1');
        } finally {
            if (previous == null) delete process.env.REPLICATE_SCORM_IMAGE_MODEL;
            else process.env.REPLICATE_SCORM_IMAGE_MODEL = previous;
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

    it('shows learners/admins why an image request is intentionally waiting', () => {
        const detail = rateLimitDetail({ waitMs: 10250, rateLimitPerMinute: 6 });
        expect(detail).to.include('6 new prediction request(s) per minute');
        expect(detail).to.include('about 11s');
    });

    it('uses a simpler safe recovery prompt when a primary slide image fails', () => {
        const prompt = recoverySlideImagePrompt({
            title: 'Verify suspicious payment requests',
            visualTitle: 'Employee checks a request using a trusted contact method'
        }, 'Social Engineering Awareness');
        expect(prompt).to.include('Wide 16:9');
        expect(prompt).to.include('realistic corporate training photograph');
        expect(prompt).to.include('No text');
    });
});
