const { expect } = require('chai');
const { guessContentType } = require('../services/scorm/ScormUnpackService');
const {
    buildEmbeddedMediaMap,
    injectReplicateMediaUi,
    replicateMediaScript,
    REPLICATE_MEDIA_CSS
} = require('../services/scorm/ScormReplicateMediaFinalizer');

describe('Generated SCORM WebP rendering', () => {
    it('serves Replicate WebP assets with an image MIME type for nosniff browsers', () => {
        expect(guessContentType('assets/media/course-cover.webp')).to.equal('image/webp');
        expect(guessContentType('assets/media/slide-003.WEBP')).to.equal('image/webp');
    });

    it('keeps an embedded WebP fallback available in the learner HTML finalizer', () => {
        const map = buildEmbeddedMediaMap([{
            path: 'assets/media/slide-001.webp',
            body: Buffer.from([0x52, 0x49, 0x46, 0x46]),
            contentType: 'image/webp'
        }]);
        expect(map['assets/media/slide-001.webp']).to.match(/^data:image\/webp;base64,/);
    });

    it('renders generated images in true responsive 16:9 frames instead of fixed-height crops', () => {
        expect(REPLICATE_MEDIA_CSS).to.include('aspect-ratio:16/9!important');
        expect(REPLICATE_MEDIA_CSS).to.include('.qmx-raster-frame');
        expect(REPLICATE_MEDIA_CSS).to.not.include('height:420px!important');
        expect(REPLICATE_MEDIA_CSS).to.not.include('height:250px!important');

        const script = replicateMediaScript({});
        expect(script).to.include("target.classList.add('qmx-raster-frame')");
        expect(script).to.include("node.querySelector('.qmx-hub-art')||node.querySelector('.spot-visual')||node.querySelector('.hero-art')");
        expect(script).to.not.include("node.querySelector('.hero-core')");
    });

    it('injects the raster installer without String.replace corrupting its $& escape sequence', () => {
        const html = injectReplicateMediaUi('<html><head></head><body></body></html>', {
            'assets/media/slide-001.webp': 'data:image/webp;base64,AAAA'
        });
        expect(html).to.include("replace(/[\"\\\\]/g,'\\\\$&')");
        expect(html).to.not.include('\\</body>');

        const match = html.match(/<script id="quizmoto-replicate-media-script-v2">([\s\S]*?)<\/script>/);
        expect(match).to.not.equal(null);
        expect(() => new Function(match[1])).to.not.throw();
    });

    it('restores raster images if a legacy SVG finalizer replaces the image child later', () => {
        const script = replicateMediaScript({});
        expect(script).to.include("var targetRaster=target.querySelector('img.qmx-replicate-raster')");
        expect(script).to.include('||!targetRaster');
        expect(script).to.include("var panelRaster=panel.querySelector('img.qmx-replicate-raster')");
        expect(script).to.include('||!panelRaster');
        expect(script).to.include('new MutationObserver');
        expect(script).to.include('watchForLegacyVisualOverrides');
    });
});
