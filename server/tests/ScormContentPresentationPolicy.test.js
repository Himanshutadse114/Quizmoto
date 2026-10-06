const { expect } = require('chai');
const scormRouter = require('../routes/scorm');

function runRepair(packageSource, html) {
    let output = '';
    const headers = { 'Content-Type': 'text/html; charset=utf-8' };
    const response = {
        locals: { scormPackageSource: packageSource },
        getHeader(name) { return headers[name]; },
        setHeader(name, value) { headers[name] = value; },
        removeHeader(name) { delete headers[name]; },
        send(body) { output = Buffer.isBuffer(body) ? body.toString('utf8') : String(body); return body; }
    };

    scormRouter.repairServedScormHtml({ originalUrl: '/api/scorm/content/test/index.html' }, response, () => {});
    response.send(html);
    return output;
}

describe('SCORM content presentation policy', () => {
    const markerHtml = '<!doctype html><html><head><script src="scorm_api_wrapper.js"></script></head><body><main class="qmx-learning-shell"></main></body></html>';

    it('does not inject LMSGEN structural scaling into uploaded third-party SCORM', () => {
        const output = runRepair('upload', markerHtml);
        expect(output).to.not.include('quizmoto-scaled-desktop-course-runtime-v8');
        expect(output).to.include('quizmoto-runtime-api-repair-v1');
    });

    it('retains legacy served-course scaling repair for LMSGEN-authored packages', () => {
        const output = runRepair('ai_author', markerHtml);
        expect(output).to.include('quizmoto-scaled-desktop-course-runtime-v8');
    });
});
