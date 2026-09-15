const { expect } = require('chai');
const JSZip = require('jszip');
const {
    STYLE_ID,
    SCRIPT_ID,
    style,
    inject,
    applyMobileHardeningRuntimeToZip
} = require('../services/scorm/ScormMobileHardeningRuntime');

describe('Template course mobile hardening runtime', () => {
    it('keeps Highly Interactive native media visible on phones', () => {
        const css = style();
        expect(css).to.include('data-qmx-course-template="highly-interactive"');
        expect(css).to.include('.qmx-native-media');
        expect(css).to.include('display:block!important');
        expect(css).to.include('visibility:visible!important');
        expect(css).to.include('aspect-ratio:16/9!important');
    });

    it('forces desktop interaction grids to one mobile column', () => {
        const css = style();
        expect(css).to.include('.qmx-cards.qmx-flip-grid');
        expect(css).to.include('.qmx-process');
        expect(css).to.include('.qmx-interaction-grid');
        expect(css).to.include('grid-template-columns:minmax(0,1fr)!important');
    });

    it('refreshes its style and script instead of duplicating or skipping them', () => {
        const source = '<!doctype html><html><head><style id="template-after">x{display:none}</style></head><body data-qmx-course-template="highly-interactive"></body></html>';
        const once = inject(source);
        const twice = inject(once);
        expect(twice.split(`id="${STYLE_ID}"`).length - 1).to.equal(1);
        expect(twice.split(`id="${SCRIPT_ID}"`).length - 1).to.equal(1);
        expect(twice.lastIndexOf(`id="${STYLE_ID}"`)).to.be.greaterThan(twice.lastIndexOf('id="template-after"'));
    });

    it('preserves SCORM files while hardening index.html', async () => {
        const zip = new JSZip();
        zip.file('index.html', '<!doctype html><html><head></head><body data-qmx-course-template="highly-interactive"></body></html>');
        zip.file('imsmanifest.xml', '<manifest/>');
        zip.file('content.json', '{"ok":true}');
        const input = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
        const output = await applyMobileHardeningRuntimeToZip(input);
        const result = await JSZip.loadAsync(output);
        const html = await result.file('index.html').async('string');
        expect(html).to.include(STYLE_ID);
        expect(html).to.include(SCRIPT_ID);
        expect(result.file('imsmanifest.xml')).to.not.equal(null);
        expect(result.file('content.json')).to.not.equal(null);
    });
});
