const { expect } = require('chai');
const slidePreviewRouter = require('../routes/scorm/slidePreview');

describe('SCORM admin preview frame policy', () => {
    it('allows the configured frontend origin without opening preview framing to a wildcard', () => {
        const previous = process.env.CORS_ORIGIN;
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.CORS_ORIGIN = 'https://quizmoto-frontend.onrender.com, https://admin.example.com/path';
        process.env.NODE_ENV = 'production';
        try {
            const policy = slidePreviewRouter.configuredPreviewAncestors();
            expect(policy).to.include("frame-ancestors 'self'");
            expect(policy).to.include('https://quizmoto-frontend.onrender.com');
            expect(policy).to.include('https://admin.example.com');
            expect(policy).to.not.include('*');
        } finally {
            if (previous == null) delete process.env.CORS_ORIGIN;
            else process.env.CORS_ORIGIN = previous;
            if (previousNodeEnv == null) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previousNodeEnv;
        }
    });

    it('removes X-Frame-Options and sets CSP on preview-only responses', () => {
        const previous = process.env.CORS_ORIGIN;
        process.env.CORS_ORIGIN = 'https://quizmoto-frontend.onrender.com';
        const headers = { 'X-Frame-Options': 'SAMEORIGIN' };
        const res = {
            removeHeader(name) { delete headers[name]; },
            setHeader(name, value) { headers[name] = value; }
        };
        try {
            slidePreviewRouter.setPreviewFrameHeaders(res);
            expect(headers).to.not.have.property('X-Frame-Options');
            expect(headers['Content-Security-Policy']).to.include('https://quizmoto-frontend.onrender.com');
        } finally {
            if (previous == null) delete process.env.CORS_ORIGIN;
            else process.env.CORS_ORIGIN = previous;
        }
    });
});
