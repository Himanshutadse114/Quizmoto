const { expect } = require('chai');
const {
    mediaConfig,
    DEFAULT_IMAGE_MODEL,
    isRetryableImageError,
    retryDelayMs,
    recoverySlideImagePrompt
} = require('../services/scorm/ReplicateCourseMediaService');

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

    it('treats rate limits, transient server errors and incomplete image downloads as retryable', () => {
        expect(isRetryableImageError({ code: 'REPLICATE_RATE_LIMIT' })).to.equal(true);
        expect(isRetryableImageError({ code: 'REPLICATE_API_ERROR', status: 503 })).to.equal(true);
        expect(isRetryableImageError({ code: 'REPLICATE_API_ERROR', status: 400 })).to.equal(false);
        expect(isRetryableImageError({ code: 'REPLICATE_MEDIA_DOWNLOAD' })).to.equal(true);
    });

    it('backs off more aggressively when Replicate rate limits the image queue', () => {
        const config = { retryBaseMs: 1400 };
        expect(retryDelayMs({ code: 'REPLICATE_RATE_LIMIT' }, 0, config)).to.be.at.least(3000);
        expect(retryDelayMs({ code: 'REPLICATE_NETWORK' }, 1, config)).to.be.greaterThan(1400);
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
