const { expect } = require('chai');
const {
    hasPresentationSource,
    hasVisualPdfSource,
    assertPdfPresentationSource,
    validateEditedQuiz
} = require('../services/scorm/ScormPresentationCourseService');

describe('ScormPresentationCourseService editing', () => {
    it('allows a quiz-only rebuild without re-uploading the presentation', () => {
        expect(hasPresentationSource({ replacePackageId: 'existing-package' })).to.equal(false);
        expect(hasPresentationSource({ sourceKey: 'ai-author/source/user/deck.pptx' })).to.equal(true);
        expect(hasPresentationSource({ fileBase64: 'AA==' })).to.equal(true);
    });

    it('recognizes an optional exact visual PDF independently of the editable source', () => {
        expect(hasVisualPdfSource({ visualSourceKey: 'ai-author/source/user/deck-visual.pdf' })).to.equal(true);
        expect(hasVisualPdfSource({ visualFileBase64: 'JVBERi0=' })).to.equal(true);
        expect(hasVisualPdfSource({ sourceKey: 'ai-author/source/user/deck.pptx' })).to.equal(false);
    });

    it('requires PDF bytes for every new presentation source', () => {
        const pdfSource = { buffer: Buffer.from('%PDF-1.7\n') };
        expect(assertPdfPresentationSource(pdfSource)).to.equal(pdfSource);
        expect(() => assertPdfPresentationSource({ buffer: Buffer.from('pptx') }))
            .to.throw('accept PDF files only')
            .with.property('code', 'SCORM_PRESENTATION_PDF_REQUIRED');
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
