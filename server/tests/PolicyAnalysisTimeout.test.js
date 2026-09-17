const { expect } = require('chai');

const {
    callGemini,
    geminiRequestTimeoutMs
} = require('../services/scorm/PolicyAnalysisService');

describe('PolicyAnalysisService request timeout', () => {
    const originalFetch = global.fetch;
    const originalTimeout = process.env.GEMINI_SCORM_REQUEST_TIMEOUT_MS;

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalTimeout == null) delete process.env.GEMINI_SCORM_REQUEST_TIMEOUT_MS;
        else process.env.GEMINI_SCORM_REQUEST_TIMEOUT_MS = originalTimeout;
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
            await callGemini({
                apiKey: 'test-key',
                model: 'gemini-test',
                parts: [{ text: 'test' }],
                timeoutMs: 20
            });
        } catch (caught) {
            error = caught;
        }

        expect(error).to.be.instanceOf(Error);
        expect(error.code).to.equal('GEMINI_TIMEOUT');
        expect(error.message).to.include('timed out');
    });

    it('keeps request timeout configuration within safe bounds', () => {
        process.env.GEMINI_SCORM_REQUEST_TIMEOUT_MS = '5';
        expect(geminiRequestTimeoutMs()).to.equal(1000);
        process.env.GEMINI_SCORM_REQUEST_TIMEOUT_MS = '999999';
        expect(geminiRequestTimeoutMs()).to.equal(300000);
    });
});
