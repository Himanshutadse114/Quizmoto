const assert = require('assert');
const {
    useVertexExpress,
    transportName,
    cloudProject,
    expressModelUrl,
    globalVertexModelUrl,
    modelMethodUrl,
    rewriteGeminiUrl
} = require('../services/scorm/GoogleGenAiTransport');

describe('GoogleGenAiTransport', () => {
    const originalTransport = process.env.GOOGLE_GENAI_TRANSPORT;
    const originalLegacyMode = process.env.GOOGLE_GENAI_USE_VERTEXAI;
    const originalCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    const originalCloudProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const originalGcpProject = process.env.GCP_PROJECT;
    const originalGcloudProject = process.env.GCLOUD_PROJECT;

    afterEach(() => {
        if (originalTransport === undefined) delete process.env.GOOGLE_GENAI_TRANSPORT;
        else process.env.GOOGLE_GENAI_TRANSPORT = originalTransport;

        if (originalLegacyMode === undefined) delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
        else process.env.GOOGLE_GENAI_USE_VERTEXAI = originalLegacyMode;

        if (originalCloudProject === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
        else process.env.GOOGLE_CLOUD_PROJECT = originalCloudProject;
        if (originalCloudProjectId === undefined) delete process.env.GOOGLE_CLOUD_PROJECT_ID;
        else process.env.GOOGLE_CLOUD_PROJECT_ID = originalCloudProjectId;
        if (originalGcpProject === undefined) delete process.env.GCP_PROJECT;
        else process.env.GCP_PROJECT = originalGcpProject;
        if (originalGcloudProject === undefined) delete process.env.GCLOUD_PROJECT;
        else process.env.GCLOUD_PROJECT = originalGcloudProject;
    });

    function clearProjectEnv() {
        delete process.env.GOOGLE_CLOUD_PROJECT;
        delete process.env.GOOGLE_CLOUD_PROJECT_ID;
        delete process.env.GCP_PROJECT;
        delete process.env.GCLOUD_PROJECT;
    }

    it('uses Vertex AI Express Mode by default', () => {
        delete process.env.GOOGLE_GENAI_TRANSPORT;
        assert.strictEqual(useVertexExpress(), true);
        assert.strictEqual(transportName(), 'Vertex AI Express Mode');
    });

    it('ignores the stale legacy false flag and stays on Vertex Express', () => {
        delete process.env.GOOGLE_GENAI_TRANSPORT;
        process.env.GOOGLE_GENAI_USE_VERTEXAI = 'false';
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

    it('builds a global Vertex publisher endpoint when the project is configured', () => {
        process.env.GOOGLE_CLOUD_PROJECT = 'example-project';
        assert.strictEqual(cloudProject(), 'example-project');
        assert.strictEqual(
            globalVertexModelUrl('gemini-2.5-flash-image', 'generateContent', 'test-key'),
            'https://aiplatform.googleapis.com/v1/projects/example-project/locations/global/publishers/google/models/gemini-2.5-flash-image:generateContent?key=test-key'
        );
    });

    it('keeps text generation on the projectless Express route even when a project is configured', () => {
        delete process.env.GOOGLE_GENAI_TRANSPORT;
        process.env.GOOGLE_CLOUD_PROJECT = 'example-project';
        assert.strictEqual(
            modelMethodUrl('gemini-2.5-flash', 'generateContent', 'test-key'),
            'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=test-key'
        );
    });

    it('routes Gemini image generation to global Vertex when the project is configured', () => {
        delete process.env.GOOGLE_GENAI_TRANSPORT;
        process.env.GOOGLE_CLOUD_PROJECT = 'example-project';
        const input = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:countTokens?key=test-key';
        assert.strictEqual(
            rewriteGeminiUrl(input),
            'https://aiplatform.googleapis.com/v1/projects/example-project/locations/global/publishers/google/models/gemini-2.5-flash-image:countTokens?key=test-key'
        );
    });

    it('falls back to Express for image models when no Cloud project is configured', () => {
        delete process.env.GOOGLE_GENAI_TRANSPORT;
        clearProjectEnv();
        const input = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:countTokens?key=test-key';
        assert.strictEqual(
            rewriteGeminiUrl(input),
            'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-image:countTokens?key=test-key'
        );
    });

    it('rewrites Gemini Developer API text calls to Vertex Express', () => {
        delete process.env.GOOGLE_GENAI_TRANSPORT;
        const input = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key';
        assert.strictEqual(
            rewriteGeminiUrl(input),
            'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=test-key'
        );
    });

    it('can explicitly fall back to the Gemini Developer API', () => {
        process.env.GOOGLE_GENAI_TRANSPORT = 'developer';
        const input = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key';
        assert.strictEqual(useVertexExpress(), false);
        assert.strictEqual(transportName(), 'Gemini Developer API');
        assert.strictEqual(rewriteGeminiUrl(input), input);
    });
});
