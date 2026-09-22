const { expect } = require('chai');
const {
    cidForSlot,
    maxAiImages,
    publicAssetUrl,
    serializeTemplate,
    visualAssetRecords
} = require('../services/awareness/AwarenessTemplateService');

describe('AwarenessTemplateService helpers', () => {
    const previousBase = process.env.AWARENESS_ASSET_BASE_URL;
    const previousMax = process.env.AWARENESS_MAX_AI_IMAGES;

    beforeEach(() => {
        process.env.AWARENESS_ASSET_BASE_URL = 'https://api.example.com/';
    });

    afterEach(() => {
        if (previousBase === undefined) delete process.env.AWARENESS_ASSET_BASE_URL;
        else process.env.AWARENESS_ASSET_BASE_URL = previousBase;
        if (previousMax === undefined) delete process.env.AWARENESS_MAX_AI_IMAGES;
        else process.env.AWARENESS_MAX_AI_IMAGES = previousMax;
    });

    it('keeps legacy one-image rows compatible', () => {
        const row = {
            id: 'legacy-id',
            title: 'Legacy template',
            topic: 'Security',
            layoutId: 'editorial-hero',
            subject: 'Legacy subject',
            contentJson: JSON.stringify({ headline: 'Legacy headline', keyPoints: [] }),
            heroStorageKey: 'awareness/1/legacy/hero.jpg',
            heroContentType: 'image/jpeg',
            publicAssetToken: 'a'.repeat(64),
            aiMetadataJson: JSON.stringify({ imageStatus: 'ready' })
        };
        const assets = visualAssetRecords(row);
        const serialized = serializeTemplate(row);

        expect(assets).to.have.length(1);
        expect(assets[0].slot).to.equal('hero');
        expect(serialized.visualCount).to.equal(1);
        expect(serialized.imageUrl).to.equal(`https://api.example.com/api/scorm/awareness-assets/${'a'.repeat(64)}`);
    });

    it('serializes multi-image metadata and slot URLs', () => {
        const row = {
            id: 'new-id',
            title: 'New template',
            topic: 'Security',
            layoutId: 'story-spotlight',
            subject: 'New subject',
            contentJson: JSON.stringify({ headline: 'New headline', keyPoints: [] }),
            heroStorageKey: 'awareness/1/new/hero.jpg',
            heroContentType: 'image/jpeg',
            publicAssetToken: 'b'.repeat(64),
            aiMetadataJson: JSON.stringify({
                imageStatus: 'ready',
                visualAssets: [
                    { slot: 'hero', storageKey: 'awareness/1/new/hero.jpg', contentType: 'image/jpeg' },
                    { slot: 'point-1', storageKey: 'awareness/1/new/point-1.jpg', contentType: 'image/jpeg' }
                ]
            })
        };

        const serialized = serializeTemplate(row);
        expect(serialized.visualCount).to.equal(2);
        expect(serialized.visuals[1].url)
            .to.equal(`https://api.example.com/api/scorm/awareness-assets/${'b'.repeat(64)}/point-1`);
        expect(cidForSlot('point-1')).to.equal('awareness-point-1@lmsgen');
        expect(publicAssetUrl('c'.repeat(64), 'banner'))
            .to.equal(`https://api.example.com/api/scorm/awareness-assets/${'c'.repeat(64)}/banner`);
    });

    it('clamps the generated image budget to a maximum of five visuals', () => {
        process.env.AWARENESS_MAX_AI_IMAGES = '99';
        expect(maxAiImages()).to.equal(5);
        process.env.AWARENESS_MAX_AI_IMAGES = '2';
        expect(maxAiImages()).to.equal(2);
        process.env.AWARENESS_MAX_AI_IMAGES = '0';
        expect(maxAiImages()).to.equal(1);
    });
});
