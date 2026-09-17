const { expect } = require('chai');
const {
    mediaConfig,
    DEFAULT_IMAGE_MODEL,
    isRetryableImageError,
    retryDelayMs,
    coverImagePrompt,
    slideImagePrompt,
    recoverySlideImagePrompt
} = require('../services/scorm/OpenAiCourseMediaService');
const { LOW_IMAGE_ESTIMATE_USD } = require('../services/openai/OpenAiClient');

describe('OpenAI SCORM image generation', () => {
    it('uses the fast OpenAI image model and a sub-10-rupee budget profile', () => {
        const keys = [
            'OPENAI_IMAGE_MODEL', 'OPENAI_SCORM_MAX_IMAGES', 'OPENAI_SCORM_MIN_IMAGES',
            'OPENAI_SCORM_IMAGE_CONCURRENCY', 'OPENAI_SCORM_IMAGE_RETRIES', 'OPENAI_COURSE_BUDGET_INR'
        ];
        const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
        keys.forEach((key) => delete process.env[key]);
        try {
            const config = mediaConfig();
            expect(DEFAULT_IMAGE_MODEL).to.equal('gpt-image-2.5-flare');
            expect(config.imageModel).to.equal(DEFAULT_IMAGE_MODEL);
            expect(config.maxImages).to.equal(5);
            expect(config.minImages).to.equal(5);
            expect(config.imageConcurrency).to.equal(5);
            expect(config.imageRetries).to.equal(0);
            expect(config.budgetInr).to.equal(10);
            expect(LOW_IMAGE_ESTIMATE_USD * config.maxImages * config.usdToInr).to.be.below(4);
        } finally {
            for (const key of keys) {
                if (previous[key] == null) delete process.env[key];
                else process.env[key] = previous[key];
            }
        }
    });

    it('creates course-grounded prompts that forbid people and embedded text', () => {
        const prompt = slideImagePrompt({
            title: 'Verify suspicious payment requests',
            content: 'Unexpected payment requests should be verified using an official contact channel before any transfer is made.',
            keyPoints: ['Check the sender', 'Use an official channel']
        }, 'Social Engineering Awareness');
        expect(prompt).to.include('Exact lesson topic: Verify suspicious payment requests');
        expect(prompt).to.include('What the learner must understand');
        expect(prompt).to.include('Non-human scene');
        expect(prompt).to.include('No text, letters, numbers');
    });

    it('keeps cover and recovery prompts course-grounded and text-free', () => {
        const cover = coverImagePrompt({ title: 'Phishing Awareness', summary: 'Recognise suspicious requests and verify them safely.' });
        const recovery = recoverySlideImagePrompt({
            title: 'Report suspicious messages',
            content: 'Report suspicious messages through the approved channel.'
        }, 'Phishing Awareness');
        for (const prompt of [cover, recovery]) {
            expect(prompt).to.include('Non-human scene');
            expect(prompt).to.include('No text, letters, numbers');
        }
    });

    it('retries only transient OpenAI image failures when retries are enabled explicitly', () => {
        expect(isRetryableImageError({ code: 'OPENAI_QUOTA', status: 429 })).to.equal(true);
        expect(isRetryableImageError({ code: 'OPENAI_UNAVAILABLE', status: 503 })).to.equal(true);
        expect(isRetryableImageError({ code: 'OPENAI_IMAGE_API_ERROR', status: 400 })).to.equal(false);
        expect(isRetryableImageError({ code: 'OPENAI_IMAGE_EMPTY' })).to.equal(true);
        const config = { retryBaseMs: 900 };
        expect(retryDelayMs({ code: 'OPENAI_QUOTA', status: 429 }, 0, config)).to.be.at.least(1800);
    });
});
