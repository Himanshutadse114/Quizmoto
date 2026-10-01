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

describe('Universal generated-course scaled desktop runtime', () => {
    it('uses one fixed 16:9 desktop canvas on smaller viewports', () => {
        const style = responsiveStyle();

        expect(STYLE_ID).to.equal('quizmoto-scaled-desktop-course-runtime-v4');
        expect(style).to.include('html.qmx-scaled-desktop body #app');
        expect(style).to.include('width:1280px!important');
        expect(style).to.include('height:720px!important');
        expect(style).to.include('transform:scale(var(--qmx-desktop-scale,1))!important');
        expect(style).to.include('transform-origin:top left!important');
    });

    it('fits and centres the complete desktop canvas using both viewport dimensions', () => {
        const script = responsiveScript();

        expect(script).to.include('Math.min(1,view.width/WIDTH,view.height/HEIGHT)');
        expect(script).to.include('(view.width-(WIDTH*scale))/2');
        expect(script).to.include('(view.height-(HEIGHT*scale))/2');
        expect(script).to.include('window.visualViewport');
        expect(script).to.include("window.addEventListener('orientationchange'");
        expect(script).to.include("data-qmx-mobile-presentation");
    });

    it('disables old width and height reflow breakpoints without changing desktop rules', () => {
        const source = '<!doctype html><html><head><style>' +
            '@media(max-width:900px){.grid{grid-template-columns:1fr}}' +
            '@media (orientation:landscape) and (max-height:500px){.bar{display:none}}' +
            '@media(prefers-reduced-motion:reduce){*{transition:none}}' +
            '</style></head><body><div id="app"></div></body></html>';
        const output = injectMobileRuntime(source);

        expect(output.match(/@media \(min-width: 99999px\)/g)).to.have.length(2);
        expect(output).to.include('@media(prefers-reduced-motion:reduce)');
        expect(output).to.not.include('@media(max-width:900px)');
        expect(output).to.not.include('(max-height:500px)');
    });

    it('replaces the former reflow runtime and injects the scaler exactly once', () => {
        const source = '<!doctype html><html><head><style id="quizmoto-mobile-course-runtime-v3">old</style></head>' +
            '<body><div id="app"></div><script id="quizmoto-mobile-course-runtime-script-v3">old</script></body></html>';
        const once = injectMobileRuntime(source);
        const twice = injectMobileRuntime(once);

        expect(once).to.not.include('quizmoto-mobile-course-runtime-v3');
        expect(once).to.not.include('quizmoto-mobile-course-runtime-script-v3');
        expect(twice.split(`id="${STYLE_ID}"`).length - 1).to.equal(1);
        expect(twice.split(`id="${SCRIPT_ID}"`).length - 1).to.equal(1);
    });

    it('applies the runtime to a course zip without removing package files', async () => {
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head></head><body><div id="app"></div></body></html>');
        zip.file('imsmanifest.xml', '<manifest/>');
        zip.file('content.json', '{"title":"Scaled test"}');
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
