const { expect } = require('chai');
const JSZip = require('jszip');
const {
    STYLE_ID,
    SCRIPT_ID,
    responsiveStyle,
    responsiveScript,
    injectMobileRuntime,
    applyMobileResponsiveRuntimeToZip
} = require('../services/scorm/ScormMobileResponsiveRuntime');

describe('Universal generated-course mobile runtime', () => {
    it('covers both classic visual layouts and qmx template layouts', () => {
        const style = responsiveStyle();

        expect(style).to.include('@media (max-width: 900px)');
        expect(style).to.include('.hero,.hub-wrap,.spotlight,.compare');
        expect(style).to.include('.cards-grid,.process,.timeline,.hub-list,.quiz-options');
        expect(style).to.include('.qmx-cover-shell,.qmx-learning-shell,.qmx-quiz-shell,.qmx-final-shell');
        expect(style).to.include('.qmx-scenario-grid,.qmx-branch-grid');
        expect(style).to.include('footer .nav-btn');
        expect(style).to.include('@media (max-width: 480px)');
        expect(style).to.include('orientation: landscape');
    });

    it('tracks the visual viewport and keeps responsive CSS after later template styles', () => {
        const script = responsiveScript();

        expect(script).to.include('window.visualViewport');
        expect(script).to.include("--qmx-safe-vh");
        expect(script).to.include('document.head.appendChild(style)');
        expect(script).to.include("window.addEventListener('orientationchange'");
        expect(script).to.include("data-qmx-mobile-runtime");
    });

    it('injects the style and runtime script exactly once', () => {
        const source = '<!doctype html><html><head></head><body><main></main></body></html>';
        const once = injectMobileRuntime(source);
        const twice = injectMobileRuntime(once);

        expect(once).to.include(STYLE_ID);
        expect(once).to.include(SCRIPT_ID);
        expect(twice.match(new RegExp(STYLE_ID, 'g'))).to.have.length(1);
        expect(twice.match(new RegExp(SCRIPT_ID, 'g'))).to.have.length(1);
    });

    it('applies the runtime to a SCORM zip without removing other package files', async () => {
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head></head><body><main></main></body></html>');
        zip.file('imsmanifest.xml', '<manifest/>');
        zip.file('content.json', '{"title":"Responsive test"}');
        const input = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });

        const output = await applyMobileResponsiveRuntimeToZip(input);
        const result = await JSZip.loadAsync(output);
        const html = await result.file('index.html').async('string');

        expect(html).to.include(STYLE_ID);
        expect(html).to.include(SCRIPT_ID);
        expect(result.file('imsmanifest.xml')).to.not.equal(null);
        expect(result.file('content.json')).to.not.equal(null);
    });
});