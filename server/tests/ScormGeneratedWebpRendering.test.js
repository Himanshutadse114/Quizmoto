const { expect } = require('chai');
const { guessContentType } = require('../services/scorm/ScormUnpackService');
const { buildEmbeddedMediaMap } = require('../services/scorm/ScormReplicateMediaFinalizer');

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
});
