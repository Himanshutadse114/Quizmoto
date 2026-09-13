const assert = require('assert');
const {
    useVertexExpress,
    transportName,
    expressModelUrl,
    rewriteGeminiUrl
} = require('../services/scorm/GoogleGenAiTransport');

describe('GoogleGenAiTransport', () => {
    const originalMode = process.env.GOOGLE_GENAI_USE_VERTEXAI;

    afterEach(() => {
        if (originalMode === undefined) delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
        else process.env.GOOGLE_GENAI_USE_VERTEXAI = originalMode;
    });

    it('uses Vertex AI Express Mode by default', () => {
        delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
        assert.strictEqual(useVertexExpress(), true);
        assert.strictEqual(transportName(), 'Vertex AI Express Mode');
    });

    it('builds the projectless Vertex Express endpoint', () => {
        const url = expressModelUrl('gemini-2.5-flash', 'generateContent', 'test-key');
        assert.strictEqual(
            url,
            'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=test-key'
        );
    });

    it('rewrites Gemini Developer API generation calls to Vertex Express', () => {
        delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
        const input = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key';
        assert.strictEqual(
            rewriteGeminiUrl(input),
            'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=test-key'
        );
    });

    it('rewrites countTokens for the image model without changing the key', () => {
        delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
        const input = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:countTokens?key=test-key';
        assert.strictEqual(
            rewriteGeminiUrl(input),
            'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-image:countTokens?key=test-key'
        );
    });

    it('can explicitly fall back to the Gemini Developer API', () => {
        process.env.GOOGLE_GENAI_USE_VERTEXAI = 'false';
        const input = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key';
        assert.strictEqual(useVertexExpress(), false);
        assert.strictEqual(transportName(), 'Gemini Developer API');
        assert.strictEqual(rewriteGeminiUrl(input), input);
    });
});
