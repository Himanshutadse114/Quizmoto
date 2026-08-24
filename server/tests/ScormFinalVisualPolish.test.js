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

    it('embeds generated learning-slide SVG assets as self-contained data URI fallbacks', async () => {
        const zip = new JSZip();
        zip.file('assets/visuals/course-cover.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
        zip.file('assets/visuals/smart-visual-001.svg', '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>');
        zip.file('assets/other.svg', '<svg/>');
        const map = await buildEmbeddedVisualMap(zip);
        expect(Object.keys(map)).to.have.members([
            'assets/visuals/course-cover.svg',
            'assets/visuals/smart-visual-001.svg'
        ]);
        expect(map['assets/visuals/smart-visual-001.svg']).to.match(/^data:image\/svg\+xml;base64,/);
    });

    it('makes the first slide a centred text-only editorial cover while preserving learning visuals', () => {
        const html = '<html><head></head><body><script>var data={"slides":[]};</script></body></html>';
        const patched = injectFinalVisualPolish(html, {
            'assets/visuals/course-cover.svg': 'data:image/svg+xml;base64,PHN2Zy8+',
            'assets/visuals/smart-visual-001.svg': 'data:image/svg+xml;base64,PHN2Zy8+'
        });
        expect(patched).to.include('quizmoto-final-authored-visual-polish-v1');
        expect(patched).to.include('font-size:52px!important');
        expect(patched).to.include('text-align:center!important');
        expect(patched).to.include('.slide.qmx-cover-slide .hero-art');
        expect(patched).to.include('display:none!important');
        expect(patched).to.include('removeCoverArtwork(intro)');
        expect(patched).to.include('addCoverMeta(intro,data)');
        expect(patched).to.include('compactSummary(data.summary,58)');
        expect(patched).to.not.include("var cover=picture(data.coverVisualAsset");
        expect(patched).to.include('.hub-svg line{display:none!important}');
        expect(patched).to.include('qmx-hub-art');
        expect(patched).to.include('window.__quizmotoData=');
        expect(FINAL_VISUAL_POLISH_CSS).to.not.include('#3a240f');
    });
});
