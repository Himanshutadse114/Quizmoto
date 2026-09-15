const { expect } = require('chai');
const sharp = require('sharp');
const {
    COURSE_IMAGE_WIDTH,
    COURSE_IMAGE_HEIGHT,
    COURSE_IMAGE_MAX_BYTES,
    optimizeCourseImage,
    optimizeCourseMedia
} = require('../services/scorm/ScormImageOptimizationService');

describe('SCORM image optimization', () => {
    it('converts a large generated image to the fixed lightweight course profile', async () => {
        const source = await sharp({
            create: {
                width: 3200,
                height: 2400,
                channels: 4,
                background: { r: 26, g: 105, b: 98, alpha: 1 }
            }
        })
            .png({ compressionLevel: 0 })
            .toBuffer();

        const result = await optimizeCourseImage({
            path: 'assets/media/course-cover.png',
            body: source,
            contentType: 'image/png'
        });
        const metadata = await sharp(result.body).metadata();

        expect(source.length).to.be.greaterThan(COURSE_IMAGE_MAX_BYTES);
        expect(result.path).to.equal('assets/media/course-cover.webp');
        expect(result.contentType).to.equal('image/webp');
        expect(result.body.length).to.be.at.most(COURSE_IMAGE_MAX_BYTES);
        expect(metadata.width).to.equal(COURSE_IMAGE_WIDTH);
        expect(metadata.height).to.equal(COURSE_IMAGE_HEIGHT);
        expect(metadata.format).to.equal('webp');
    });

    it('updates cover and slide references when source extensions change', async () => {
        const source = await sharp({
            create: { width: 800, height: 600, channels: 3, background: '#203040' }
        }).jpeg({ quality: 100 }).toBuffer();
        const analysis = {
            coverImageAsset: 'assets/media/cover.jpg',
            coverVisualAsset: 'assets/media/cover.jpg',
            coverMobileVisualAsset: 'assets/media/cover.jpg',
            slides: [{
                visualAsset: 'assets/media/slide.png',
                rasterVisualAsset: 'assets/media/slide.png',
                mobileVisualAsset: 'assets/media/slide.png',
                visualAssetType: 'image/png'
            }]
        };
        const result = await optimizeCourseMedia(analysis, [
            { path: 'assets/media/cover.jpg', body: source, contentType: 'image/jpeg' },
            { path: 'assets/media/slide.png', body: source, contentType: 'image/png' }
        ]);

        expect(result.analysis.coverVisualAsset).to.equal('assets/media/cover.webp');
        expect(result.analysis.slides[0].visualAsset).to.equal('assets/media/slide.webp');
        expect(result.analysis.slides[0].visualAssetType).to.equal('image/webp');
        expect(result.files).to.have.length(2);
        expect(result.files.every((file) => file.width === COURSE_IMAGE_WIDTH)).to.equal(true);
        expect(result.files.every((file) => file.height === COURSE_IMAGE_HEIGHT)).to.equal(true);
        expect(result.files.every((file) => file.byteSize <= COURSE_IMAGE_MAX_BYTES)).to.equal(true);
    });

    it('does not re-encode an already compliant WebP during rebuilds', async () => {
        const body = await sharp({
            create: {
                width: COURSE_IMAGE_WIDTH,
                height: COURSE_IMAGE_HEIGHT,
                channels: 3,
                background: '#f3efe4'
            }
        }).webp({ quality: 72 }).toBuffer();
        const result = await optimizeCourseImage({
            path: 'assets/media/slide-001.webp',
            body,
            contentType: 'image/webp'
        });

        expect(result.body.equals(body)).to.equal(true);
        expect(result.byteSize).to.equal(body.length);
    });
});
