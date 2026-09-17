const { expect } = require('chai');

const {
    callOpenAI,
    openAiRequestTimeoutMs
} = require('../services/scorm/PolicyAnalysisService');

describe('PolicyAnalysisService request timeout', () => {
    const originalFetch = global.fetch;
    const originalTimeout = process.env.OPENAI_SCORM_REQUEST_TIMEOUT_MS;
    const originalKey = process.env.OPENAI_API_KEY;

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalTimeout == null) delete process.env.OPENAI_SCORM_REQUEST_TIMEOUT_MS;
        else process.env.OPENAI_SCORM_REQUEST_TIMEOUT_MS = originalTimeout;
        if (originalKey == null) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = originalKey;
    });

    it('aborts a provider request that does not settle', async () => {
        global.fetch = (_url, options = {}) => new Promise((resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });

        let error = null;
        try {
            process.env.OPENAI_API_KEY = 'test-key';
            await callOpenAI({
                model: 'gpt-test',
                parts: [{ text: 'test' }],
                timeoutMs: 20
            });
        } catch (caught) {
            error = caught;
        }

        expect(error).to.be.instanceOf(Error);
        expect(error.code).to.equal('OPENAI_TIMEOUT');
        expect(error.message).to.include('timed out');
    });

    it('keeps request timeout configuration within safe bounds', () => {
        process.env.OPENAI_SCORM_REQUEST_TIMEOUT_MS = '5';
        expect(openAiRequestTimeoutMs()).to.equal(1000);
        process.env.OPENAI_SCORM_REQUEST_TIMEOUT_MS = '999999';
        expect(openAiRequestTimeoutMs()).to.equal(180000);
    });
});
