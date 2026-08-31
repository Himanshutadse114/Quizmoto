const { expect } = require('chai');
const {
    modelEndpoint,
    vertexConfig
} = require('../services/scorm/VertexAiClient');
const {
    falEndpoint,
    parseDataUri
} = require('../services/scorm/FalAiClient');
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
const {
    selectedProvider,
    providerServices,
    serviceAccountConfigured
} = require('../services/scorm/CourseAiService');
const { setProgress, getProgress } = require('../services/scorm/ScormGenerationProgress');
const { planExperienceV5 } = require('../services/scorm/ScormExperiencePlanner');
const { repairQuizExplanations, explanationWordCount } = require('../services/scorm/ScormQuizQualityService');

describe('Gemini service-account + fal.ai FLUX Schnell SCORM integration', () => {
    it('selects Gemini through Vertex only when service-account configuration is present', () => {
        const previousProject = process.env.GOOGLE_CLOUD_PROJECT;
        const previousCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        try {
            process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
            process.env.GOOGLE_APPLICATION_CREDENTIALS = '/etc/secrets/google-service-account.json';
            expect(serviceAccountConfigured()).to.equal(true);
            expect(selectedProvider()).to.equal('vertex_ai');
            expect(providerServices().auth).to.equal('service_account');
        } finally {
            if (previousProject == null) delete process.env.GOOGLE_CLOUD_PROJECT;
            else process.env.GOOGLE_CLOUD_PROJECT = previousProject;
            if (previousCredentials == null) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
            else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentials;
        }
    });

    it('does not fall back to the Gemini Developer API when the service account is missing', () => {
        const previousProject = process.env.GOOGLE_CLOUD_PROJECT;
        const previousGcloudProject = process.env.GCLOUD_PROJECT;
        const previousCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        try {
            delete process.env.GOOGLE_CLOUD_PROJECT;
            delete process.env.GCLOUD_PROJECT;
            delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
            expect(selectedProvider()).to.equal('unconfigured');
            expect(() => providerServices()).to.throw('Google service account');
            try {
                providerServices();
            } catch (error) {
                expect(error.code).to.equal('GEMINI_KEY_MISSING');
            }
        } finally {
            if (previousProject == null) delete process.env.GOOGLE_CLOUD_PROJECT;
            else process.env.GOOGLE_CLOUD_PROJECT = previousProject;
            if (previousGcloudProject == null) delete process.env.GCLOUD_PROJECT;
            else process.env.GCLOUD_PROJECT = previousGcloudProject;
            if (previousCredentials == null) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
            else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentials;
        }
    });

    it('keeps the official Vertex Gemini endpoint for service-account text generation', () => {
        expect(modelEndpoint('gemini-2.5-flash', 'global', 'test-project')).to.equal(
            'https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models/gemini-2.5-flash:generateContent'
        );
        const previousText = process.env.VERTEX_TEXT_MODEL;
        try {
            process.env.VERTEX_TEXT_MODEL = 'gemini-2.5-flash';
            expect(vertexConfig().textModel).to.equal('gemini-2.5-flash');
        } finally {
            if (previousText == null) delete process.env.VERTEX_TEXT_MODEL;
            else process.env.VERTEX_TEXT_MODEL = previousText;
        }
    });

    it('targets the official fal.run FLUX Schnell endpoint and can decode sync-mode output', () => {
        expect(falEndpoint('fal-ai/flux/schnell')).to.equal('https://fal.run/fal-ai/flux/schnell');
        const encoded = Buffer.alloc(700, 7).toString('base64');
        const decoded = parseDataUri(`data:image/jpeg;base64,${encoded}`);
        expect(decoded.contentType).to.equal('image/jpeg');
        expect(decoded.body.length).to.equal(700);
    });

    it('uses an image-rich default budget and keeps the old evenly spaced slide selection', () => {
        const keys = ['FAL_SCORM_MAX_IMAGES', 'FAL_SCORM_MIN_IMAGES', 'VERTEX_SCORM_MAX_IMAGES', 'VERTEX_SCORM_MIN_IMAGES'];
        const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
        keys.forEach((key) => delete process.env[key]);
        try {
            expect(mediaConfig().maxImages).to.equal(8);
            expect(mediaConfig().minImages).to.equal(6);
            expect(imageSlideIndexes(new Array(10).fill({}), 7)).to.deep.equal([0, 2, 3, 5, 6, 8, 9]);
        } finally {
            for (const key of keys) {
                if (previous[key] == null) delete process.env[key];
                else process.env[key] = previous[key];
            }
        }
    });

    it('keeps sentence excerpts useful for image prompts', () => {
        const text = 'The first sentence explains the concept clearly. The second sentence gives the learner a practical workplace example. The third sentence explains the correct action to take.';
        const excerpt = sentenceExcerpt(text, 145);
        expect(excerpt.length).to.be.at.most(145);
        expect(excerpt).to.include('first sentence');
        expect(excerpt).to.match(/[.!?…]$/);
    });

    it('asks FLUX Schnell for a wide modern visual with no people or generated typography', () => {
        const prompt = coverImagePrompt({
            title: 'Phishing Awareness',
            summary: 'Learn how to recognise suspicious requests and verify them safely.'
        });
        expect(prompt.toLowerCase()).to.include('16:9');
        expect(prompt).to.include('NON-HUMAN VISUAL ONLY');
        expect(prompt).to.include('ABSOLUTELY NO TEXT IN THE IMAGE');
        expect(prompt).to.include('modern semi-realistic 3D render');
        expect(prompt).to.include('premium studio lighting');
    });

    it('keeps fal.ai raster imagery compatible with the existing package finalizer', () => {
        const html = '<html><head></head><body><script>var data=window.__quizmotoData={slides:[]};</script></body></html>';
        const patched = injectReplicateMediaUi(html);
        expect(patched).to.include('quizmoto-replicate-media-v3');
        expect(patched).to.include('quizmoto-replicate-media-script-v2');
        expect(patched).to.not.include('qmx-narration-btn');
        expect(patched).to.not.include('<audio');
        expect(REPLICATE_MEDIA_CSS).to.include('quizmoto-replicate-media-v3');

        const manifest = '<manifest><resources><resource identifier="r"><file href="index.html"/></resource></resources></manifest>';
        const updated = injectManifestFiles(manifest, ['assets/media/course-cover.jpg', 'assets/media/slide-001.jpg']);
        expect(updated).to.include('assets/media/course-cover.jpg');
        expect(updated).to.include('assets/media/slide-001.jpg');
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
        const id = 'progress-test-fal-1234';
        setProgress(id, 'user-a', { task: 'analyze', percent: 8, stage: 'Creating course content with Gemini service account' });
        expect(getProgress(id, 'user-a').percent).to.equal(8);
        expect(getProgress(id, 'user-b')).to.equal(null);
    });
});
