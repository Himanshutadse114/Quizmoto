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
const { planExperienceV5 } = require('../services/scorm/ScormExperiencePlanner');
const { repairQuizExplanations, explanationWordCount } = require('../services/scorm/ScormQuizQualityService');

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

    it('uses an image-rich default budget with a minimum visual quality gate', () => {
        const previousMax = process.env.REPLICATE_SCORM_MAX_IMAGES;
        const previousMin = process.env.REPLICATE_SCORM_MIN_IMAGES;
        delete process.env.REPLICATE_SCORM_MAX_IMAGES;
        delete process.env.REPLICATE_SCORM_MIN_IMAGES;
        try {
            expect(mediaConfig().maxImages).to.equal(8);
            expect(mediaConfig().minImages).to.equal(6);
            expect(imageSlideIndexes(new Array(10).fill({}), 7)).to.deep.equal([0, 2, 3, 5, 6, 8, 9]);
        } finally {
            if (previousMax == null) delete process.env.REPLICATE_SCORM_MAX_IMAGES;
            else process.env.REPLICATE_SCORM_MAX_IMAGES = previousMax;
            if (previousMin == null) delete process.env.REPLICATE_SCORM_MIN_IMAGES;
            else process.env.REPLICATE_SCORM_MIN_IMAGES = previousMin;
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
        expect(prompt).to.include('believable workplace scene');
    });

    it('injects packaged raster imagery into every layout without audio controls', () => {
        const html = '<html><head></head><body><script>var data=window.__quizmotoData={slides:[]};</script></body></html>';
        const patched = injectReplicateMediaUi(html);
        expect(patched).to.include('quizmoto-replicate-media-v2');
        expect(patched).to.include('qmx-cover-raster');
        expect(patched).to.include('qmx-raster-panel');
        expect(patched).to.include("stage.classList.add('qmx-raster-stage')");
        expect(patched).to.not.include('qmx-narration-btn');
        expect(patched).to.not.include('<audio');
        expect(REPLICATE_MEDIA_CSS).to.include('grid-template-areas:"head image" "body image"');

        const manifest = '<manifest><resources><resource identifier="r"><file href="index.html"/></resource></resources></manifest>';
        const updated = injectManifestFiles(manifest, ['assets/media/course-cover.webp', 'assets/media/slide-001.webp']);
        expect(updated).to.include('assets/media/course-cover.webp');
        expect(updated).to.include('assets/media/slide-001.webp');
        expect(updated).to.not.include('.wav');
    });

    it('prevents a course of repeated AI cards from becoming card/reveal only', () => {
        const slides = Array.from({ length: 10 }, (_, index) => ({
            title: index === 2 ? 'How phishing works step by step' : `Social engineering lesson ${index + 1}`,
            content: index === 5
                ? 'Compare a safe request versus a suspicious urgent request. Verify the sender before acting because attackers exploit urgency. For example, a colleague may receive an unexpected payment request. Check the request using an official channel before proceeding. This protects organisational data and reduces the risk of fraud.'
                : 'Social engineering manipulates people into unsafe decisions. Attackers use urgency and trust because these signals can cause rushed actions. For example, an employee may receive an unexpected request from someone claiming to be a manager. Verify the request using an official channel before acting. Report suspicious activity so the organisation can respond quickly. This reduces the chance of data loss or fraud.',
            keyPoints: ['Pause before acting', 'Verify independently', 'Check the sender', 'Report suspicious requests'],
            layout: 'cards'
        }));
        const planned = planExperienceV5({ title: 'Course', slides, quiz: [] });
        const cardFamily = planned.slides.filter((slide) => ['cards', 'hub'].includes(slide.layout));
        const interactive = planned.slides.filter((slide) => ['reveal', 'hotspot'].includes(slide.screenType));
        const layouts = new Set(planned.slides.map((slide) => slide.layout));

        expect(cardFamily.length).to.be.at.most(2);
        expect(interactive.length).to.be.at.most(2);
        expect(layouts.has('spotlight')).to.equal(true);
        expect(layouts.size).to.be.greaterThan(1);
    });

    it('guarantees a meaningful quiz explanation when the AI returns a blank one', () => {
        const repaired = repairQuizExplanations({
            slides: [{
                title: 'Verify urgent requests',
                content: 'Attackers often create urgency because rushed decisions reduce careful checking. If you receive an unexpected payment request, verify the sender using an official contact method before transferring funds. This reduces the risk of fraud and account compromise.',
                keyPoints: ['Verify independently']
            }],
            quiz: [{
                question: 'You receive an urgent payment request from a manager. What should you do first?',
                options: ['Pay immediately', 'Verify using an official channel', 'Forward it to colleagues', 'Ignore all future requests'],
                correctAnswer: 1,
                explanation: ''
            }]
        });
        expect(repaired.quiz[0].explanation).to.include('Verify using an official channel');
        expect(explanationWordCount(repaired.quiz[0].explanation)).to.be.at.least(20);
        expect(repaired.quizIntegrity.repairedExplanations).to.equal(1);
    });

    it('shows the real quiz explanation in learner feedback after an answer', () => {
        const patched = injectReplicateMediaUi('<html><head></head><body></body></html>');
        expect(patched).to.include('qmx-feedback-with-explanation');
        expect(patched).to.include('q.explanation');
        expect(patched).to.include('qmx-feedback-explanation');
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
