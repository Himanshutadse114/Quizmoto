const { expect } = require('chai');
const {
    cidForSlot,
    imagePromptForSlot,
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

    it('creates deliberately different art direction for each image slot', () => {
        const content = {
            headline: 'Safer QR code use',
            intro: 'Pause before scanning unexpected codes.',
            bodyParagraphs: ['Verify the source first.'],
            keyPoints: [
                { title: 'Check the source', body: 'Confirm where the QR code came from.' },
                { title: 'Inspect the destination', body: 'Review the address before continuing.' },
                { title: 'Avoid unexpected sign-ins', body: 'Do not enter credentials after an unexpected scan.' },
                { title: 'Report concerns', body: 'Tell the security team about suspicious prompts.' }
            ],
            footerNote: 'Pause, verify and proceed safely.'
        };
        const common = {
            ai: { imagePrompt: 'A workplace employee considering whether to scan an unexpected QR code.' },
            input: { topic: 'QR code phishing', audience: 'Employees' },
            content,
            layoutId: 'story-spotlight'
        };
        const hero = imagePromptForSlot({ ...common, slot: 'hero' });
        const pointOne = imagePromptForSlot({ ...common, slot: 'point-1' });
        const pointTwo = imagePromptForSlot({ ...common, slot: 'point-2' });
        const pointThree = imagePromptForSlot({ ...common, slot: 'point-3' });
        const banner = imagePromptForSlot({ ...common, slot: 'banner' });

        expect(new Set([hero, pointOne, pointTwo, pointThree, banner]).size).to.equal(5);
        expect(hero).to.include('WIDE ESTABLISHING IMAGE');
        expect(pointOne).to.include('DETAIL IMAGE');
        expect(pointTwo).to.include('ACTION IMAGE');
        expect(pointThree).to.include('TOP-DOWN / GRAPHIC IMAGE');
        expect(banner).to.include('PANORAMIC BANNER IMAGE');
        expect(pointOne).to.include('no generic glowing padlock or shield');
        expect(hero).to.include('Cinematic incident-story photography');
    });

    it('uses different visual languages for different email layouts', () => {
        const base = {
            slot: 'hero',
            ai: { imagePrompt: 'A practical workplace security scene.' },
            input: { topic: 'Security awareness', audience: 'Employees' },
            content: {
                headline: 'Security awareness',
                bodyParagraphs: [],
                keyPoints: []
            }
        };
        const newsletter = imagePromptForSlot({ ...base, layoutId: 'editorial-hero' });
        const highRisk = imagePromptForSlot({ ...base, layoutId: 'split-feature' });
        const aiSignal = imagePromptForSlot({ ...base, layoutId: 'minimal-note' });

        expect(newsletter).to.include('Warm editorial lifestyle photography');
        expect(highRisk).to.include('High-contrast documentary field-briefing photography');
        expect(aiSignal).to.include('Surreal-but-believable editorial photo-collage');
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
