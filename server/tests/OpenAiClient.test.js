const { expect } = require('chai');
const {
    strictJsonSchema,
    outputText,
    usageCostUsd,
    DEFAULT_TEXT_MODEL,
    DEFAULT_IMAGE_MODEL
} = require('../services/openai/OpenAiClient');

describe('OpenAiClient', () => {
    it('uses the budget text and image models selected for course generation', () => {
        expect(DEFAULT_TEXT_MODEL).to.equal('gpt-5.6-luna');
        expect(DEFAULT_IMAGE_MODEL).to.equal('gpt-image-2.5-flare');
    });

    it('makes every object in a response schema strict', () => {
        const schema = strictJsonSchema({
            type: 'object',
            required: ['course'],
            properties: {
                course: {
                    type: 'object',
                    required: ['title'],
                    properties: { title: { type: 'string' } }
                }
            }
        });
        expect(schema.additionalProperties).to.equal(false);
        expect(schema.properties.course.additionalProperties).to.equal(false);
    });

    it('reads Responses API output and estimates Luna text cost', () => {
        const text = outputText({
            output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }]
        });
        expect(text).to.equal('{"ok":true}');
        expect(usageCostUsd({ input_tokens: 1000000, output_tokens: 1000000 })).to.equal(1.4);
    });
});
