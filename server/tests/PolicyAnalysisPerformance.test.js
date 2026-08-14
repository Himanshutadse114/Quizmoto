const { expect } = require('chai');
const {
    thinkingLevel,
    generationConfigForModel,
    SCORM_ANALYSIS_SCHEMA
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
        const config = generationConfigForModel('gemini-3.6-flash');
        expect(config.responseMimeType).to.equal('application/json');
        expect(config.responseJsonSchema).to.equal(SCORM_ANALYSIS_SCHEMA);
        expect(config.maxOutputTokens).to.equal(32768);
        expect(config.temperature).to.equal(0.35);
        expect(config.thinkingConfig).to.deep.equal({ thinkingLevel: 'low' });
    });

    it('allows medium/high/minimal to be configured without code changes', () => {
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'medium';
        expect(generationConfigForModel('gemini-3.6-flash').thinkingConfig.thinkingLevel).to.equal('medium');
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'high';
        expect(thinkingLevel()).to.equal('high');
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'minimal';
        expect(thinkingLevel()).to.equal('minimal');
    });

    it('keeps structured JSON and output budget on Gemini 2.5 fallback models', () => {
        const config = generationConfigForModel('gemini-2.5-flash');
        expect(config.responseMimeType).to.equal('application/json');
        expect(config.responseJsonSchema).to.equal(SCORM_ANALYSIS_SCHEMA);
        expect(config.maxOutputTokens).to.equal(32768);
        expect(config.temperature).to.equal(0.35);
        expect(config).to.not.have.property('thinkingConfig');
    });

    it('defines the required course structure in the Gemini JSON schema', () => {
        expect(SCORM_ANALYSIS_SCHEMA.required).to.deep.equal(['title', 'summary', 'slides', 'quiz']);
        expect(SCORM_ANALYSIS_SCHEMA.properties.slides.items.required).to.include.members([
            'title', 'content', 'keyPoints', 'layout', 'visualTitle', 'interaction', 'imageQuery'
        ]);
        expect(SCORM_ANALYSIS_SCHEMA.properties.quiz.items.required).to.deep.equal([
            'question', 'options', 'correctAnswer', 'explanation'
        ]);
    });

    it('falls back to low for an invalid environment value', () => {
        process.env.GEMINI_SCORM_THINKING_LEVEL = 'fastest';
        expect(thinkingLevel()).to.equal('low');
    });
});
