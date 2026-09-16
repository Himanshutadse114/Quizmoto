const { expect } = require('chai');
const sharp = require('sharp');
const {
    presentationKind,
    processRasterSlides
} = require('../services/scorm/ScormPresentationRenderer');

async function sampleSlide(accent) {
    return sharp({
        create: {
            width: 1800,
            height: 1013,
            channels: 3,
            background: '#f8fafc'
        }
    })
        .composite([{
            input: Buffer.from(`<svg width="1800" height="1013" xmlns="http://www.w3.org/2000/svg"><rect x="100" y="120" width="900" height="120" rx="24" fill="${accent}"/><rect x="100" y="300" width="1450" height="18" fill="#334155"/></svg>`)
        }])
        .png()
        .toBuffer();
}

describe('ScormPresentationRenderer', () => {
    it('accepts PPTX and PDF presentation sources only', () => {
        expect(presentationKind('application/pdf', 'deck.bin')).to.equal('pdf');
        expect(presentationKind('', 'deck.pptx')).to.equal('pptx');
        expect(() => presentationKind('image/png', 'deck.png'))
            .to.throw('support PPTX and PDF')
            .with.property('code', 'SCORM_PRESENTATION_TYPE_UNSUPPORTED');
    });

    it('normalizes every slide to fixed dimensions and compact WebP files', async () => {
        const result = await processRasterSlides([
            await sampleSlide('#0f766e'),
            await sampleSlide('#f97316')
        ], { maxEdge: 1200, maxBytes: 180 * 1024 });

        expect(result.slides).to.have.length(2);
        expect(result.width).to.equal(1200);
        expect(result.height).to.be.lessThan(700);
        for (const slide of result.slides) {
            expect(slide.width).to.equal(result.width);
            expect(slide.height).to.equal(result.height);
            expect(slide.path).to.match(/^slides\/slide-\d{3}\.webp$/);
            expect(slide.byteSize).to.be.lessThan(180 * 1024);
            const metadata = await sharp(slide.body).metadata();
            expect(metadata.format).to.equal('webp');
            expect(metadata.width).to.equal(result.width);
            expect(metadata.height).to.equal(result.height);
        }
        expect(result.theme.primary).to.match(/^#[0-9a-f]{6}$/);
        expect(result.theme.background).to.match(/^#[0-9a-f]{6}$/);
    });
});
