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

describe('Template course mobile responsive runtime v7', () => {
    it('preserves the LMS flex viewport and keeps the active slide in normal flow', () => {
        const css = style();
        expect(STYLE_ID).to.equal('quizmoto-mobile-course-responsive-v7');
        expect(SCRIPT_ID).to.equal('quizmoto-mobile-course-responsive-script-v7');
        expect(css).to.include('.qmx-course-body');
        expect(css).to.include('display:flex!important;flex-direction:column!important;flex:1 1 0!important');
        expect(css).to.include('overflow-x:hidden!important;overflow-y:auto!important');
        expect(css).to.include('position:relative!important;inset:auto!important');
        expect(css).to.include('height:auto!important;min-height:100%!important;max-height:none!important');
    });

    it('does not globally hide every slide and supports native current-slide states plus a fallback', () => {
        const css = style();
        const js = script();
        const baseStart = css.indexOf('html.qmx-mobile-layout-v7 body .slide,');
        const activeStart = css.indexOf('html.qmx-mobile-layout-v7 body .slide.active,');
        expect(css.slice(baseStart, activeStart)).to.not.include('display:none!important');
        expect(css).to.include('.slide.active');
        expect(css).to.include('.slide.is-active');
        expect(css).to.include('.slide[data-active="true"]');
        expect(css).to.include('.slide[data-current="true"]');
        expect(css).to.include('.slide[aria-hidden="false"]');
        expect(css).to.include('.slide.qmx-mobile-visible-v7');
        expect(js).to.include("classList.toggle('qmx-mobile-visible-v7'");
    });

    it('still detects a phone inside an oversized LMS iframe', () => {
        const js = script();
        expect(js).to.include('window.visualViewport&&window.visualViewport.width');
        expect(js).to.include('window.screen&&window.screen.width');
        expect(js).to.include('Math.min.apply(Math,values)');
        expect(js).to.include('mobile=w<=1024');
    });

    it('stacks mobile content and keeps replaced interaction sources out of flow', () => {
        const css = style();
        expect(css).to.include('grid-template-columns:minmax(0,1fr)!important');
        expect(css).to.include('.qmx-process.qmx-interaction-source');
        expect(css).to.include('display:none!important;visibility:hidden!important;position:absolute!important');
        expect(css).to.include('height:0!important;min-height:0!important;max-height:0!important');
        expect(css).to.include('aspect-ratio:16/9!important');
    });

    it('removes every older mobile runtime before injecting v7', () => {
        const source = '<!doctype html><html><head>' +
            '<style id="quizmoto-mobile-course-runtime-v3">old3</style>' +
            '<style id="quizmoto-mobile-course-hardening-v4">old4</style>' +
            '<style id="quizmoto-mobile-course-responsive-v5">old5</style>' +
            '<style id="quizmoto-mobile-course-responsive-v6">old6</style>' +
            '<style id="quizmoto-mobile-width-wrap-hotfix-v1">oldhotfix</style>' +
            '</head><body>' +
            '<script id="quizmoto-mobile-course-runtime-script-v3">old3</script>' +
            '<script id="quizmoto-mobile-course-hardening-script-v4">old4</script>' +
            '<script id="quizmoto-mobile-course-responsive-script-v5">old5</script>' +
            '<script id="quizmoto-mobile-course-responsive-script-v6">old6</script>' +
            '</body></html>';
        const output = inject(source);
        expect(output).to.include(STYLE_ID);
        expect(output).to.include(SCRIPT_ID);
        expect(output).to.not.include('quizmoto-mobile-course-runtime-v3');
        expect(output).to.not.include('quizmoto-mobile-course-hardening-v4');
        expect(output).to.not.include('quizmoto-mobile-course-responsive-v5');
        expect(output).to.not.include('quizmoto-mobile-course-responsive-v6');
        expect(output).to.not.include('quizmoto-mobile-width-wrap-hotfix-v1');
    });

    it('refreshes v7 idempotently while preserving package files', async () => {
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head></head><body><section class="slide active">Hello</section></body></html>');
        zip.file('imsmanifest.xml', '<manifest/>');
        zip.file('content.json', '{"ok":true}');
        const input = await zip.generateAsync({ type:'nodebuffer', compression:'STORE' });
        const once = await applyMobileHardeningRuntimeToZip(input);
        const twice = await applyMobileHardeningRuntimeToZip(once);
        const result = await JSZip.loadAsync(twice);
        const html = await result.file('index.html').async('string');
        expect(html.split(`id="${STYLE_ID}"`).length - 1).to.equal(1);
        expect(html.split(`id="${SCRIPT_ID}"`).length - 1).to.equal(1);
        expect(html).to.include('Hello');
        expect(result.file('imsmanifest.xml')).to.not.equal(null);
        expect(result.file('content.json')).to.not.equal(null);
    });
});
