const { expect } = require('chai');
const {
    modelEndpoint,
    outputText,
    outputUrl
} = require('../services/scorm/ReplicateClient');
const {
    imageSlideIndexes,
    sentenceExcerpt,
    mediaConfig,
    coverImagePrompt
} = require('../services/scorm/ReplicateCourseMediaService');
const {
    injectReplicateMediaUi,
    injectManifestFiles,
    REPLICATE_MEDIA_CSS
} = require('../services/scorm/ScormReplicateMediaFinalizer');
const { cleanupModelText } = require('../services/scorm/CourseAiService');

describe('Replicate low-cost SCORM integration', () => {
    it('builds the official-model prediction endpoint safely', () => {
        expect(modelEndpoint('black-forest-labs/flux-schnell')).to.equal(
            'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions'
        );
        expect(() => modelEndpoint('invalid')).to.throw('Invalid Replicate model identifier');
    });

    it('normalizes text and URL outputs returned by Replicate predictions', () => {
        expect(outputText(['{"title":', '"Course"}'])).to.equal('{"title":"Course"}');
        expect(outputUrl(['https://replicate.delivery/course.webp'])).to.equal('https://replicate.delivery/course.webp');
    });

    it('removes model reasoning wrappers before JSON parsing', () => {
        const raw = '<think>private reasoning</think><response>{"title":"Course"}</response>';
        expect(cleanupModelText(raw)).to.equal('{"title":"Course"}');
    });

    it('keeps the default raster-image budget at five images including the cover', () => {
        const previous = process.env.REPLICATE_SCORM_MAX_IMAGES;
        delete process.env.REPLICATE_SCORM_MAX_IMAGES;
        try {
            expect(mediaConfig().maxImages).to.equal(5);
            expect(imageSlideIndexes(new Array(10).fill({}), 4)).to.deep.equal([0, 3, 6, 9]);
        } finally {
            if (previous == null) delete process.env.REPLICATE_SCORM_MAX_IMAGES;
            else process.env.REPLICATE_SCORM_MAX_IMAGES = previous;
        }
    });

    it('caps narration copy without cutting every slide down to a robotic fragment', () => {
        const text = 'The first sentence explains the concept clearly. The second sentence gives the learner a practical workplace example. The third sentence explains the correct action to take. The fourth sentence reinforces why the behaviour matters.';
        const excerpt = sentenceExcerpt(text, 145);
        expect(excerpt.length).to.be.at.most(145);
        expect(excerpt).to.include('first sentence');
        expect(excerpt).to.match(/[.!?…]$/);
    });

    it('asks FLUX for a photographic cover with no generated typography', () => {
        const prompt = coverImagePrompt({ title: 'Phishing Awareness', summary: 'Learn how to recognise suspicious requests and verify them safely.' });
        expect(prompt).to.include('Wide 16:9');
        expect(prompt).to.include('No words');
        expect(prompt).to.include('no vector art');
    });

    it('injects packaged raster cover, narration UI and manifest file entries', () => {
        const html = '<html><head></head><body><script>var data=window.__quizmotoData={slides:[]};</script></body></html>';
        const patched = injectReplicateMediaUi(html);
        expect(patched).to.include('quizmoto-replicate-media-v1');
        expect(patched).to.include('qmx-cover-raster');
        expect(patched).to.include('qmx-narration-btn');
        expect(REPLICATE_MEDIA_CSS).to.include('background-size:cover');

        const manifest = '<manifest><resources><resource identifier="r"><file href="index.html"/></resource></resources></manifest>';
        const updated = injectManifestFiles(manifest, ['assets/media/course-cover.webp', 'assets/media/narration-001.wav']);
        expect(updated).to.include('assets/media/course-cover.webp');
        expect(updated).to.include('assets/media/narration-001.wav');
    });
});
