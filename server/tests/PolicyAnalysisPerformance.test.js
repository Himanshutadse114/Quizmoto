const { expect } = require('chai');
const {
    thinkingLevel,
    generationConfigForModel,
    SCORM_ANALYSIS_SCHEMA
} = require('../services/scorm/PolicyAnalysisService');

describe('PolicyAnalysisService OpenAI performance config', () => {
    it('uses no reasoning and strict structured output for low-latency course analysis', () => {
        expect(thinkingLevel()).to.equal('none');
        const config = generationConfigForModel('gpt-5.6-luna');
        expect(config.model).to.equal('gpt-5.6-luna');
        expect(config.reasoning).to.deep.equal({ effort: 'none' });
        expect(config.text.format.schema).to.equal(SCORM_ANALYSIS_SCHEMA);
        expect(config.text.format.strict).to.equal(true);
        expect(config.maxOutputTokens).to.equal(14000);
    });

    it('defines the required course structure in the OpenAI JSON schema', () => {
        expect(SCORM_ANALYSIS_SCHEMA.required).to.deep.equal(['title', 'summary', 'slides', 'quiz']);
        expect(SCORM_ANALYSIS_SCHEMA.properties.slides.items.required).to.include.members([
            'title', 'learningPurpose', 'content', 'keyPoints', 'layout', 'visualTitle',
            'visualDirection', 'interaction', 'imageQuery'
        ]);
        expect(SCORM_ANALYSIS_SCHEMA.properties.quiz.items.required).to.deep.equal([
            'question', 'options', 'correctAnswer', 'explanation'
        ]);
    });

});
