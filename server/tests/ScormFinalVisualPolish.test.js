const { expect } = require('chai');
const JSZip = require('jszip');
const {
    buildEmbeddedVisualMap,
    exposeAuthorData,
    injectFinalVisualPolish,
    FINAL_VISUAL_POLISH_CSS
} = require('../services/scorm/ScormAnswerTrackingPackageFinalizer');

describe('SCORM final authored visual polish', () => {
    it('exposes authored course data for the final runtime visual pass', () => {
        const html = '<script>(function(){var data={"title":"Course","slides":[]};})();</script>';
        const patched = exposeAuthorData(html);
        expect(patched).to.include('var data=window.__quizmotoData=');
    });

    it('embeds generated SVG assets as self-contained data URI fallbacks', async () => {
        const zip = new JSZip();
        zip.file('assets/visuals/course-cover.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
        zip.file('assets/visuals/smart-visual-001.svg', '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>');
        zip.file('assets/other.svg', '<svg/>');
        const map = await buildEmbeddedVisualMap(zip);
        expect(Object.keys(map)).to.have.members([
            'assets/visuals/course-cover.svg',
            'assets/visuals/smart-visual-001.svg'
        ]);
        expect(map['assets/visuals/course-cover.svg']).to.match(/^data:image\/svg\+xml;base64,/);
    });

    it('injects a fixed course-cover typography system and hub fallback without brown or overlapping connectors', () => {
        const html = '<html><head></head><body><script>var data={"slides":[]};</script></body></html>';
        const patched = injectFinalVisualPolish(html, {
            'assets/visuals/course-cover.svg': 'data:image/svg+xml;base64,PHN2Zy8+'
        });
        expect(patched).to.include('quizmoto-final-authored-visual-polish-v1');
        expect(patched).to.include('font-size:40px!important');
        expect(patched).to.include('.hub-svg line{display:none!important}');
        expect(patched).to.include('qmx-hub-art');
        expect(patched).to.include('compactSummary(data.summary,72)');
        expect(patched).to.include('window.__quizmotoData=');
        expect(FINAL_VISUAL_POLISH_CSS).to.not.include('#3a240f');
    });
});
