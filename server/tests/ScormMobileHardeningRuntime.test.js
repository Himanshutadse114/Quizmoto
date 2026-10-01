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

describe('Served authored-course scaled desktop runtime', () => {
    it('owns the final 1280 by 720 course canvas', () => {
        const css = style();

        expect(STYLE_ID).to.equal('quizmoto-scaled-desktop-course-runtime-v8');
        expect(SCRIPT_ID).to.equal('quizmoto-scaled-desktop-course-script-v8');
        expect(css).to.include('width:1280px!important');
        expect(css).to.include('height:720px!important');
        expect(css).to.include('--qmx-desktop-left');
        expect(css).to.include('--qmx-desktop-top');
    });

    it('scales on either constrained dimension and restores native desktop mode', () => {
        const js = script();

        expect(js).to.include('view.width<WIDTH||view.height<HEIGHT');
        expect(js).to.include('Math.min(1,view.width/WIDTH,view.height/HEIGHT)');
        expect(js).to.include("root.classList.toggle('qmx-scaled-desktop',scaled)");
        expect(js).to.include("app.removeAttribute('data-qmx-scaled-desktop')");
        expect(js).to.include('visualViewport.addEventListener');
    });

    it('removes every older mobile runtime before injecting the final scaler', () => {
        const source = '<!doctype html><html><head>' +
            '<style id="quizmoto-mobile-course-runtime-v3">old3</style>' +
            '<style id="quizmoto-mobile-course-hardening-v4">old4</style>' +
            '<style id="quizmoto-mobile-course-responsive-v5">old5</style>' +
            '<style id="quizmoto-mobile-course-responsive-v6">old6</style>' +
            '<style id="quizmoto-mobile-course-responsive-v7">old7</style>' +
            '<style id="quizmoto-scaled-desktop-course-runtime-v4">package scaler</style>' +
            '<style id="quizmoto-mobile-width-wrap-hotfix-v1">oldhotfix</style>' +
            '</head><body><div id="app"></div>' +
            '<script id="quizmoto-mobile-course-runtime-script-v3">old3</script>' +
            '<script id="quizmoto-mobile-course-responsive-script-v7">old7</script>' +
            '<script id="quizmoto-scaled-desktop-course-script-v4">package scaler</script>' +
            '</body></html>';
        const output = inject(source);

        expect(output).to.include(STYLE_ID);
        expect(output).to.include(SCRIPT_ID);
        expect(output).to.not.include('quizmoto-mobile-course-runtime-v3');
        expect(output).to.not.include('quizmoto-mobile-course-hardening-v4');
        expect(output).to.not.include('quizmoto-mobile-course-responsive-v5');
        expect(output).to.not.include('quizmoto-mobile-course-responsive-v6');
        expect(output).to.not.include('quizmoto-mobile-course-responsive-v7');
        expect(output).to.not.include('quizmoto-scaled-desktop-course-runtime-v4');
        expect(output).to.not.include('quizmoto-mobile-width-wrap-hotfix-v1');
    });

    it('refreshes the scaler idempotently while preserving package files', async () => {
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head></head><body><div id="app"><section class="slide active">Hello</section></div></body></html>');
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
