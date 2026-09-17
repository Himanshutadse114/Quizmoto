const { expect } = require('chai');
const { mediaConfig } = require('../services/scorm/OpenAiCourseMediaService');
const { openAiRequestTimeoutMs, DETAIL_CONFIG } = require('../services/scorm/PolicyAnalysisService');

describe('OpenAI course generation SLA profile', () => {
    it('uses one content pass and one concurrent image wave for the three-minute target', () => {
        const config = mediaConfig();
        expect(openAiRequestTimeoutMs()).to.equal(80000);
        expect(config.mediaDeadlineMs).to.equal(80000);
        expect(config.maxImages).to.equal(5);
        expect(config.imageConcurrency).to.equal(5);
        expect(config.imageRetries).to.equal(0);
        expect(Object.values(DETAIL_CONFIG).every((level) => level.refinementPasses === 0)).to.equal(true);
    });

    it('keeps the default image spend comfortably below the ten-rupee course budget', () => {
        const config = mediaConfig();
        const imageCostInr = 0.0065 * config.maxImages * config.usdToInr;
        expect(imageCostInr).to.be.below(4);
        expect(config.budgetInr).to.equal(10);
    });
});
