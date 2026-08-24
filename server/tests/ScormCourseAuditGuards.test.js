const { expect } = require('chai');
const { planExperienceV5 } = require('../services/scorm/ScormExperiencePlanner');
const {
    ensureQuizIntegrity,
    quizIntegrityIssues,
    explanationWordCount
} = require('../services/scorm/ScormQuizQualityService');
const {
    injectReplicateMediaUi,
    REPLICATE_MEDIA_CSS
} = require('../services/scorm/ScormReplicateMediaFinalizer');

function teachingCopy(topic = 'the request') {
    return `Attackers can manipulate ${topic} to create pressure and reduce careful checking. This creates risk because employees may act before confirming who is really making the request. For example, a colleague may receive an unexpected message that appears to come from a trusted person. The learner should pause and verify the request using an official contact method before proceeding. Reporting suspicious activity helps the organisation investigate quickly and protect other employees. This behaviour reduces the chance of fraud, data loss or unauthorised access.`;
}

function maxSameRun(values) {
    let max = 0;
    let run = 0;
    let previous = null;
    values.forEach((value) => {
        if (value === previous) run += 1;
        else {
            previous = value;
            run = 1;
        }
        max = Math.max(max, run);
    });
    return max;
}

describe('SCORM generated-course audit guards', () => {
    it('does not preserve an entire AI course as repeated Process slides', () => {
        const slides = Array.from({ length: 9 }, (_, index) => ({
            title: `Social engineering lesson ${index + 1}`,
            content: teachingCopy('social engineering'),
            keyPoints: ['Pause before acting', 'Verify independently', 'Check the sender', 'Report suspicious activity', 'Protect sensitive data'],
            layout: 'process'
        }));

        const planned = planExperienceV5({ title: 'Social Engineering', slides, quiz: [] });
        const layouts = planned.slides.map((slide) => slide.layout);

        expect(layouts).to.include('process');
        expect(layouts).to.include('spotlight');
        expect(maxSameRun(layouts)).to.be.at.most(2);
        expect(planned.experiencePlanner).to.equal('balanced-visual-v8');
    });

    it('limits reveal/card density and visible point count', () => {
        const slides = Array.from({ length: 10 }, (_, index) => ({
            title: `Security rules ${index + 1}`,
            content: teachingCopy('urgent requests'),
            keyPoints: ['Point one useful detail', 'Point two useful detail', 'Point three useful detail', 'Point four useful detail', 'Point five should not render'],
            layout: 'cards'
        }));

        const planned = planExperienceV5({ title: 'Course', slides, quiz: [] });
        const cardFamily = planned.slides.filter((slide) => ['cards', 'hub'].includes(slide.layout));
        const clickReveal = planned.slides.filter((slide) => ['reveal', 'hotspot'].includes(slide.screenType));

        expect(cardFamily.length).to.be.at.most(2);
        expect(clickReveal.length).to.be.at.most(2);
        cardFamily.forEach((slide) => expect(slide.keyPoints.length).to.be.at.most(4));
    });

    it('repairs a missing quiz explanation before the draft reaches the editor', () => {
        const analysis = ensureQuizIntegrity({
            slides: [{
                title: 'Verify urgent requests',
                content: teachingCopy('urgent payment requests'),
                keyPoints: ['Verify independently']
            }],
            quiz: [{
                question: 'You receive an urgent payment request from a manager. What should you do first?',
                options: ['Pay immediately', 'Verify using an official channel', 'Forward it to colleagues', 'Ignore all future requests'],
                correctAnswer: 1,
                explanation: ''
            }]
        });

        expect(analysis.quizIntegrity.valid).to.equal(true);
        expect(analysis.quizIntegrity.repairedExplanations).to.equal(1);
        expect(explanationWordCount(analysis.quiz[0].explanation)).to.be.at.least(20);
        expect(analysis.quiz[0].explanation).to.include('Verify using an official channel');
    });

    it('fails early when an AI knowledge check is structurally malformed', () => {
        const malformed = {
            slides: [{ title: 'Verify requests', content: teachingCopy('requests'), keyPoints: [] }],
            quiz: [{
                question: 'What should you do when an unexpected request asks for sensitive information?',
                options: ['Verify the request', 'Verify the request', '', 'Send the information'],
                correctAnswer: 7,
                explanation: ''
            }]
        };

        expect(quizIntegrityIssues(malformed).length).to.be.greaterThan(0);
        expect(() => ensureQuizIntegrity(malformed))
            .to.throw('The AI returned an incomplete knowledge check')
            .with.property('code', 'SCORM_QUIZ_INCOMPLETE');
    });

    it('keeps raster rendering universal and contains no audio UI', () => {
        const html = injectReplicateMediaUi('<html><head></head><body><script>window.__quizmotoData={slides:[],quiz:[]}</script></body></html>');
        expect(html).to.include('quizmoto-replicate-media-v2');
        expect(html).to.include('qmx-raster-panel');
        expect(html).to.include("stage.classList.add('qmx-raster-stage')");
        expect(html).to.include('qmx-feedback-explanation');
        expect(html).to.not.include('<audio');
        expect(html).to.not.include('qmx-narration');
        expect(REPLICATE_MEDIA_CSS).to.include('grid-template-areas:"head image" "body image"');
    });
});
