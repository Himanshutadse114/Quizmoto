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
    it('covers classic visual layouts and qmx template layouts', () => {
        const style = responsiveStyle();

        expect(style).to.include('@media (max-width: 900px)');
        expect(style).to.include('.hero,.hub-wrap,.spotlight,.compare');
        expect(style).to.include('.cards-grid,.process,.timeline,.hub-list,.quiz-options');
        expect(style).to.include('html body[data-qmx-course-template] .qmx-cover-shell');
        expect(style).to.include('html body[data-qmx-course-template] .qmx-scenario-grid');
        expect(style).to.include('footer .nav-btn');
        expect(style).to.include('@media (max-width: 480px)');
        expect(style).to.include('orientation: landscape');
    });

    it('wins against highly-interactive desktop !important rules on mobile', () => {
        const style = responsiveStyle();

        expect(style).to.include('html body[data-qmx-course-template="highly-interactive"] .qmx-cover-shell');
        expect(style).to.include('html body[data-qmx-course-template="highly-interactive"] .qmx-learning-shell.has-image');
        expect(style).to.include('--qmx-stage-width:100%!important');
        expect(style).to.include('--qmx-stage-height:auto!important');
        expect(style).to.include('grid-template-columns:minmax(0,1fr)!important');
    });

    it('tracks the visual viewport and keeps responsive CSS after later template styles', () => {
        const script = responsiveScript();

        expect(script).to.include('window.visualViewport');
        expect(script).to.include('--qmx-safe-vh');
        expect(script).to.include('document.head.appendChild(style)');
        expect(script).to.include("window.addEventListener('orientationchange'");
        expect(script).to.include('data-qmx-mobile-runtime');
        expect(script).to.include('MutationObserver');
    });

    it('injects the v3 style and runtime script exactly once', () => {
        const source = '<!doctype html><html><head></head><body><main></main></body></html>';
        const once = injectMobileRuntime(source);
        const twice = injectMobileRuntime(once);

        expect(once).to.include(STYLE_ID);
        expect(once).to.include(SCRIPT_ID);
        expect(twice.split(`id="${STYLE_ID}"`).length - 1).to.equal(1);
        expect(twice.split(`id="${SCRIPT_ID}"`).length - 1).to.equal(1);
    });

    it('upgrades an existing v2-authored course by adding v3', () => {
        const v2 = '<!doctype html><html><head><style id="quizmoto-mobile-course-runtime-v2"></style></head><body><script id="quizmoto-mobile-course-runtime-script-v2"></script></body></html>';
        const upgraded = injectMobileRuntime(v2);

        expect(upgraded).to.include('quizmoto-mobile-course-runtime-v2');
        expect(upgraded).to.include(STYLE_ID);
        expect(upgraded).to.include(SCRIPT_ID);
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