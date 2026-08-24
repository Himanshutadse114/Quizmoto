const { expect } = require('chai');
const {
    modelEndpoint,
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
const { selectedProvider } = require('../services/scorm/CourseAiService');
const { setProgress, getProgress } = require('../services/scorm/ScormGenerationProgress');
const { planExperienceV5 } = require('../services/scorm/ScormExperiencePlanner');
const { repairQuizExplanations, explanationWordCount } = require('../services/scorm/ScormQuizQualityService');

describe('Hybrid Gemini content + Replicate image SCORM integration', () => {
    it('uses Gemini for course content even when a legacy Replicate provider variable remains set', () => {
        const previous = process.env.SCORM_AI_PROVIDER;
        process.env.SCORM_AI_PROVIDER = 'replicate';
        try {
            expect(selectedProvider()).to.equal('gemini');
        } finally {
            if (previous == null) delete process.env.SCORM_AI_PROVIDER;
            else process.env.SCORM_AI_PROVIDER = previous;
        }
    });

    it('builds the official FLUX prediction endpoint safely', () => {
        expect(modelEndpoint('black-forest-labs/flux-schnell')).to.equal(
            'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions'
        );
        expect(() => modelEndpoint('invalid')).to.throw('Invalid Replicate model identifier');
    });

    it('normalizes image URLs returned by Replicate predictions', () => {
        expect(outputUrl(['https://replicate.delivery/course.webp'])).to.equal('https://replicate.delivery/course.webp');
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

    it('keeps server-side progress associated with the requesting user', () => {
        const id = 'progress-test-1234';
        setProgress(id, 'user-a', { task: 'analyze', percent: 8, stage: 'Creating course content with Gemini' });
        expect(getProgress(id, 'user-a').percent).to.equal(8);
        expect(getProgress(id, 'user-b')).to.equal(null);
    });

    it('still surfaces live Replicate status for image generation', () => {
        const states = [];
        notifyStatus({ onStatus: (state) => states.push(state) }, { id: 'p1', status: 'starting' }, 'black-forest-labs/flux-schnell');
        expect(states).to.have.length(1);
        expect(states[0]).to.include({ status: 'starting', predictionId: 'p1' });
    });
});
