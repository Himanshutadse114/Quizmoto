const { expect } = require('chai');
const JSZip = require('jszip');
const {
    mergeExistingVisuals,
    reuseExistingCourseMedia
} = require('../services/scorm/ScormCourseMediaReuseService');

describe('SCORM course media reuse', () => {
    it('keeps existing visual paths while applying edited text', () => {
        const previous = {
            title: 'Old title',
            coverVisualAsset: 'assets/media/course-cover.webp',
            visualMode: 'raster',
            slides: [
                {
                    title: 'Old slide title',
                    content: 'Old content',
                    visualAsset: 'assets/media/slide-001.webp',
                    rasterVisualAsset: 'assets/media/slide-001.webp',
                    imagePrompt: 'old visual prompt'
                }
            ]
        };
        const edited = {
            title: 'New title',
            slides: [{ title: 'Updated slide title', content: 'Updated text' }]
        };

        const merged = mergeExistingVisuals(edited, previous);
        expect(merged.title).to.equal('New title');
        expect(merged.slides[0].title).to.equal('Updated slide title');
        expect(merged.slides[0].content).to.equal('Updated text');
        expect(merged.coverVisualAsset).to.equal('assets/media/course-cover.webp');
        expect(merged.slides[0].visualAsset).to.equal('assets/media/slide-001.webp');
        expect(merged.slides[0].imagePrompt).to.equal('old visual prompt');
    });

    it('reuses image bytes from the existing ZIP and records zero new image generation', async () => {
        const previous = {
            title: 'Existing course',
            coverImageAsset: 'assets/media/course-cover.webp',
            coverVisualAsset: 'assets/media/course-cover.webp',
            visualMode: 'raster',
            replicateMedia: { totalImagesGenerated: 2, estimatedImageCostUsd: 0.006 },
            slides: [
                {
                    title: 'Slide one',
                    visualAsset: 'assets/media/slide-001.webp',
                    rasterVisualAsset: 'assets/media/slide-001.webp'
                }
            ]
        };

        const zip = new JSZip();
        zip.file('content.json', JSON.stringify(previous));
        zip.file('assets/media/course-cover.webp', Buffer.from('cover-image-data'));
        zip.file('assets/media/slide-001.webp', Buffer.from('slide-image-data'));
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        const pkg = {
            storageKeyZip: 'packages/existing.zip',
            analysisJson: JSON.stringify(previous)
        };
        const storage = {
            getObjectBuffer: async () => zipBuffer
        };
        const edited = {
            title: 'Existing course',
            slides: [{ title: 'Updated slide', content: 'Updated learner text' }]
        };

        const result = await reuseExistingCourseMedia({ pkg, analysis: edited, storage });
        expect(result.files).to.have.length(2);
        expect(result.analysis.slides[0].title).to.equal('Updated slide');
        expect(result.analysis.slides[0].visualAsset).to.equal('assets/media/slide-001.webp');
        expect(result.metadata.reusedOnRebuild).to.equal(true);
        expect(result.metadata.reusedImages).to.equal(2);
        expect(result.metadata.totalImagesGenerated).to.equal(0);
        expect(result.metadata.estimatedImageCostUsd).to.equal(0);
    });

    it('fails instead of silently generating a replacement when an existing visual is missing', async () => {
        const previous = {
            coverVisualAsset: 'assets/media/course-cover.webp',
            visualMode: 'raster',
            slides: [{ visualAsset: 'assets/media/slide-001.webp' }]
        };
        const zip = new JSZip();
        zip.file('assets/media/course-cover.webp', Buffer.from('cover-image-data'));
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        let caught = null;
        try {
            await reuseExistingCourseMedia({
                pkg: { storageKeyZip: 'packages/existing.zip', analysisJson: JSON.stringify(previous) },
                analysis: { slides: [{}] },
                storage: { getObjectBuffer: async () => zipBuffer }
            });
        } catch (err) {
            caught = err;
        }

        expect(caught).to.not.equal(null);
        expect(caught.code).to.equal('SCORM_REBUILD_MEDIA_MISSING');
        expect(caught.message).to.include('stopped instead of generating a replacement image');
    });
});
