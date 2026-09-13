const assert = require('assert');
const {
    rewriteVertexRequestBody,
    normalizeVertexRequest
} = require('../services/scorm/GoogleGenAiTransport');

describe('Vertex Express request compatibility', () => {
    it('converts responseJsonSchema to responseSchema', () => {
        const body = JSON.stringify({
            contents: [{ parts: [{ text: 'hello' }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseJsonSchema: {
                    type: 'object',
                    properties: { ok: { type: 'boolean' } },
                    required: ['ok']
                }
            }
        });

        const rewritten = JSON.parse(rewriteVertexRequestBody(body));
        assert.ok(rewritten.generationConfig.responseSchema);
        assert.strictEqual(rewritten.generationConfig.responseJsonSchema, undefined);
    });

    it('converts text/plain inlineData into a normal text part', () => {
        const source = 'Topic: Demo\n\nDescription: Example course';
        const body = JSON.stringify({
            contents: [{
                parts: [{
                    inlineData: {
                        mimeType: 'text/plain',
                        data: Buffer.from(source, 'utf8').toString('base64')
                    }
                }]
            }]
        });

        const rewritten = JSON.parse(rewriteVertexRequestBody(body));
        assert.strictEqual(rewritten.contents[0].parts[0].text, source);
        assert.strictEqual(rewritten.contents[0].parts[0].inlineData, undefined);
    });

    it('normalizes both URL and body for Vertex calls', () => {
        const result = normalizeVertexRequest(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key',
            {
                method: 'POST',
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'hello' }] }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseJsonSchema: { type: 'object' }
                    }
                })
            }
        );

        assert.match(String(result.input), /aiplatform\.googleapis\.com/);
        const payload = JSON.parse(result.init.body);
        assert.ok(payload.generationConfig.responseSchema);
        assert.strictEqual(payload.generationConfig.responseJsonSchema, undefined);
    });
});
