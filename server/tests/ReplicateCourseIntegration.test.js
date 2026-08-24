const { expect } = require('chai');
const {
    modelEndpoint,
    outputText,
    outputUrl,
    notifyStatus
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
const { cleanupModelText, textPredictionProgress } = require('../services/scorm/CourseAiService');
const { setProgress, getProgress } = require('../services/scorm/ScormGenerationProgress');

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

    it('keeps sentence excerpts useful for image prompts', () => {
        const text = 'The first sentence explains the concept clearly. The second sentence gives the learner a practical workplace example. The third sentence explains the correct action to take.';
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

    it('injects packaged raster imagery without any narration controls', () => {
        const html = '<html><head></head><body><script>var data=window.__quizmotoData={slides:[]};</script></body></html>';
        const patched = injectReplicateMediaUi(html);
        expect(patched).to.include('quizmoto-replicate-media-v1');
        expect(patched).to.include('qmx-cover-raster');
        expect(patched).to.not.include('qmx-narration-btn');
        expect(patched).to.not.include('<audio');
        expect(REPLICATE_MEDIA_CSS).to.include('background-size:cover');

        const manifest = '<manifest><resources><resource identifier="r"><file href="index.html"/></resource></resources></manifest>';
        const updated = injectManifestFiles(manifest, ['assets/media/course-cover.webp', 'assets/media/slide-001.webp']);
        expect(updated).to.include('assets/media/course-cover.webp');
        expect(updated).to.include('assets/media/slide-001.webp');
        expect(updated).to.not.include('.wav');
    });

    it('surfaces real Replicate starting and processing states to course progress', () => {
        const updates = [];
        const handler = textPredictionProgress((patch) => updates.push(patch), 'draft');
        handler({ status: 'starting', predictionId: 'pred-1' });
        handler({ status: 'processing', predictionId: 'pred-1' });
        handler({ status: 'succeeded', predictionId: 'pred-1' });
        expect(updates[0].stage).to.equal('Waiting for Replicate model to start');
        expect(updates[0].percent).to.equal(7);
        expect(updates[1].stage).to.equal('Writing professional course content');
        expect(updates[1].percent).to.equal(24);
        expect(updates[2].percent).to.equal(56);
    });

    it('keeps server-side progress associated with the requesting user', () => {
        const id = 'progress-test-1234';
        setProgress(id, 'user-a', { task: 'analyze', percent: 7, stage: 'Waiting for Replicate model to start' });
        expect(getProgress(id, 'user-a').percent).to.equal(7);
        expect(getProgress(id, 'user-b')).to.equal(null);
    });

    it('notifies callers when Replicate exposes a prediction state', () => {
        const states = [];
        notifyStatus({ onStatus: (state) => states.push(state) }, { id: 'p1', status: 'starting' }, 'ibm-granite/granite-3.3-8b-instruct');
        expect(states).to.have.length(1);
        expect(states[0]).to.include({ status: 'starting', predictionId: 'p1' });
    });
});
