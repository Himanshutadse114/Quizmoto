const { expect } = require('chai');
const {
    hasPresentationSource,
    validateEditedQuiz
} = require('../services/scorm/ScormPresentationCourseService');

describe('ScormPresentationCourseService editing', () => {
    it('allows a quiz-only rebuild without re-uploading the presentation', () => {
        expect(hasPresentationSource({ replacePackageId: 'existing-package' })).to.equal(false);
        expect(hasPresentationSource({ sourceKey: 'ai-author/source/user/deck.pptx' })).to.equal(true);
        expect(hasPresentationSource({ fileBase64: 'AA==' })).to.equal(true);
    });

    it('normalizes a complete edited quiz and rejects partially completed questions', () => {
        const quiz = validateEditedQuiz({
            title: 'Edited check',
            questions: [{
                question: 'Which action is safest?',
                options: ['A', 'B', 'C', 'D'],
                correctAnswer: 2,
                explanation: 'The presentation identifies option C as the safest response.'
            }]
        });
        expect(quiz.title).to.equal('Edited check');
        expect(quiz.questions).to.have.length(1);
        expect(() => validateEditedQuiz({
            questions: [{ question: 'Incomplete', options: ['A', '', 'C', 'D'], correctAnswer: 0 }]
        })).to.throw('Complete every quiz question')
            .with.property('code', 'SCORM_PRESENTATION_QUIZ_INVALID');
    });
});
