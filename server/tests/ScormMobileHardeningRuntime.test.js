const { expect } = require('chai');
const JSZip = require('jszip');
const {
    STYLE_ID,
    SCRIPT_ID,
    style,
    script,
    inject,
    applyMobileHardeningRuntimeToZip
} = require('../services/scorm/ScormMobileHardeningRuntime');

describe('Template course mobile responsive runtime v5', () => {
    it('uses a structural mobile class instead of relying only on media queries', () => {
        const css = style();
        const js = script();
        expect(STYLE_ID).to.equal('quizmoto-mobile-course-responsive-v5');
        expect(SCRIPT_ID).to.equal('quizmoto-mobile-course-responsive-script-v5');
        expect(css).to.include('html.qmx-mobile-layout-v5');
        expect(css).to.include('position:relative!important');
        expect(css).to.include('display:block!important');
        expect(js).to.include('window.screen&&window.screen.width');
        expect(js).to.include('window.visualViewport&&window.visualViewport.width');
        expect(js).to.include("root.style.setProperty('--qmx-mobile-vw'");
        expect(js).to.include("classList.toggle('qmx-mobile-layout-v5',mobile)");
    });

    it('constrains the whole course to the detected device width for oversized LMS iframes', () => {
        const css = style();
        expect(css).to.include('width:var(--qmx-mobile-vw,100%)!important');
        expect(css).to.include('max-width:var(--qmx-mobile-vw,100%)!important');
        expect(css).to.include('overflow-x:hidden!important');
    });

    it('takes active slides out of the fixed desktop stage on mobile', () => {
        const css = style();
        expect(css).to.include('.slide[data-qmx-template-stage="true"].active');
        expect(css).to.include('--qmx-stage-width:100%!important');
        expect(css).to.include('--qmx-stage-height:auto!important');
        expect(css).to.include('inset:auto!important');
        expect(css).to.include('height:auto!important');
        expect(css).to.include('overflow:visible!important');
    });

    it('keeps Highly Interactive media visible and stacks every major mobile grid', () => {
        const css = style();
        expect(css).to.include('body[data-qmx-course-template="highly-interactive"] .qmx-native-media');
        expect(css).to.include('display:block!important');
        expect(css).to.include('visibility:visible!important');
        expect(css).to.include('aspect-ratio:16/9!important');
        expect(css).to.include('.qmx-cards.qmx-flip-grid');
        expect(css).to.include('.qmx-process');
        expect(css).to.include('.qmx-compare');
        expect(css).to.include('.qmx-options');
        expect(css).to.include('.qmx-interaction-grid');
        expect(css).to.include('grid-template-columns:minmax(0,1fr)!important');
    });

    it('removes the old v4 runtime and refreshes v5 without duplication', () => {
        const legacy = '<style id="quizmoto-mobile-course-hardening-v4">old</style><script id="quizmoto-mobile-course-hardening-script-v4">old</script>';
        const source = `<!doctype html><html><head><style id="template-after">x{display:none}</style>${legacy}</head><body data-qmx-course-template="highly-interactive"></body></html>`;
        const once = inject(source);
        const twice = inject(once);
        expect(twice).to.not.include('quizmoto-mobile-course-hardening-v4');
        expect(twice).to.not.include('quizmoto-mobile-course-hardening-script-v4');
        expect(twice.split(`id="${STYLE_ID}"`).length - 1).to.equal(1);
        expect(twice.split(`id="${SCRIPT_ID}"`).length - 1).to.equal(1);
        expect(twice.lastIndexOf(`id="${STYLE_ID}"`)).to.be.greaterThan(twice.lastIndexOf('id="template-after"'));
    });

    it('preserves SCORM files while replacing v4 with v5 in index.html', async () => {
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head><style id="quizmoto-mobile-course-hardening-v4">old</style></head><body data-qmx-course-template="highly-interactive"><script id="quizmoto-mobile-course-hardening-script-v4">old</script></body></html>');
        zip.file('imsmanifest.xml', '<manifest/>');
        zip.file('content.json', '{"ok":true}');
        const input = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
        const output = await applyMobileHardeningRuntimeToZip(input);
        const result = await JSZip.loadAsync(output);
        const html = await result.file('index.html').async('string');
        expect(html).to.include(STYLE_ID);
        expect(html).to.include(SCRIPT_ID);
        expect(html).to.not.include('quizmoto-mobile-course-hardening-v4');
        expect(result.file('imsmanifest.xml')).to.not.equal(null);
        expect(result.file('content.json')).to.not.equal(null);
    });
});
