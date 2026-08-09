const { expect } = require('chai');
const {
    thinkingLevel,
    generationConfigForModel
} = require('../services/scorm/PolicyAnalysisService');

describe('PolicyAnalysisService performance config', () => {
    const original = process.env.GEMINI_SCORM_THINKING_LEVEL;

    afterEach(() => {
        if (original == null) delete process.env.GEMINI_SCORM_THINKING_LEVEL;
        else process.env.GEMINI_SCORM_THINKING_LEVEL = original;
    });

    it('uses low thinking by default for lower-latency Gemini 3 SCORM analysis', () => {
        delete process.env.GEMINI_SCORM_THINKING_LEVEL;
        expect(thinkingLevel()).to.equal('low');
        expect(generationConfigForModel('gemini-3.6-flash')).to.deep.equal({
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: 'low' }
        });
    });

    it('allows medium/high/minimal to be configured without code changes', () => {
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'medium';
        expect(generationConfigForModel('gemini-3.6-flash').thinkingConfig.thinkingLevel).to.equal('medium');
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'high';
        expect(thinkingLevel()).to.equal('high');
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'minimal';
        expect(thinkingLevel()).to.equal('minimal');
    });

    it('does not send Gemini 3 thinking-level fields to 2.5 fallback models', () => {
        expect(generationConfigForModel('gemini-2.5-flash')).to.deep.equal({
            responseMimeType: 'application/json'
        });
    });

    it('falls back to low for an invalid environment value', () => {
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'fastest';
        expect(thinkingLevel()).to.equal('low');
    });
});
