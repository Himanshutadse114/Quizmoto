const { expect } = require('chai');
const {
    runWithConcurrency,
    mediaConfig
} = require('../services/scorm/OpenAiCourseMediaService');
const fs = require('fs');
const path = require('path');

describe('OpenAI course media concurrency', () => {
    it('never exceeds the configured worker limit', async () => {
        let active = 0;
        let peak = 0;
        const seen = [];

        await runWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (item) => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 8));
            seen.push(item);
            active -= 1;
        });

        expect(peak).to.equal(2);
        expect(seen.sort((a, b) => a - b)).to.deep.equal([0, 1, 2, 3, 4, 5]);
    });

    it('defaults to five image workers and caps the environment override at five', () => {
        const previous = process.env.OPENAI_SCORM_IMAGE_CONCURRENCY;
        try {
            delete process.env.OPENAI_SCORM_IMAGE_CONCURRENCY;
            expect(mediaConfig().imageConcurrency).to.equal(5);
            process.env.OPENAI_SCORM_IMAGE_CONCURRENCY = '9';
            expect(mediaConfig().imageConcurrency).to.equal(5);
            process.env.OPENAI_SCORM_IMAGE_CONCURRENCY = '1';
            expect(mediaConfig().imageConcurrency).to.equal(1);
        } finally {
            if (previous == null) delete process.env.OPENAI_SCORM_IMAGE_CONCURRENCY;
            else process.env.OPENAI_SCORM_IMAGE_CONCURRENCY = previous;
        }
    });

    it('generates the cover alongside the bounded slide-image workers', () => {
        const source = fs.readFileSync(path.join(__dirname, '../services/scorm/OpenAiCourseMediaService.js'), 'utf8');
        expect(source).to.include('const coverTask = (async () => {');
        expect(source).to.include('const slideTask = runWithConcurrency(selectedIndexes, config.imageConcurrency');
        expect(source).to.include('await Promise.all([coverTask, slideTask])');
    });
});
