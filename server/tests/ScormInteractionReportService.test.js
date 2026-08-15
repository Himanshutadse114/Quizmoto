const { expect } = require('chai');
const {
    extractInteractions,
    answerSummary
} = require('../services/scorm/ScormInteractionReportService');
const {
    injectAnswerTracking
} = require('../services/scorm/ScormAnswerTrackingPackageFinalizer');

describe('SCORM answer-level reporting', () => {
    const packageRow = {
        analysisJson: JSON.stringify({
            quiz: [
                {
                    question: 'What should you do with a suspicious link?',
                    options: ['Open it', 'Report and verify it', 'Forward it', 'Ignore policy'],
                    correctAnswer: 1,
                    explanation: 'Verify suspicious links through a trusted channel.'
                }
            ]
        })
    };

    it('extracts Quizmoto AI-course question and learner answer evidence', () => {
        const state = {
            values: {
                'quizmoto.quiz.0.question': 'What should you do with a suspicious link?',
                'quizmoto.quiz.0.selected_index': '0',
                'quizmoto.quiz.0.correct_index': '1',
                'quizmoto.quiz.0.result': 'incorrect',
                'quizmoto.quiz.0.explanation': 'Verify suspicious links through a trusted channel.'
            }
        };

        const rows = extractInteractions({ state, packageRow });
        expect(rows).to.have.length(1);
        expect(rows[0]).to.include({
            selectedAnswer: 'Open it',
            correctAnswer: 'Report and verify it',
            result: 'Incorrect'
        });
        expect(rows[0].question).to.equal('What should you do with a suspicious link?');
    });

    it('extracts standard SCORM cmi.interactions from uploaded packages', () => {
        const state = {
            values: {
                'cmi.interactions.0.id': 'question-1',
                'cmi.interactions.0.type': 'choice',
                'cmi.interactions.0.student_response': '1',
                'cmi.interactions.0.correct_responses.0.pattern': '1',
                'cmi.interactions.0.result': 'correct'
            }
        };

        const rows = extractInteractions({ state, packageRow });
        expect(rows).to.have.length(1);
        expect(rows[0].id).to.equal('question-1');
        expect(rows[0].selectedAnswer).to.equal('Report and verify it');
        expect(rows[0].correctAnswer).to.equal('Report and verify it');
        expect(rows[0].result).to.equal('Correct');
    });

    it('summarizes captured and graded answers', () => {
        const summary = answerSummary([
            { result: 'Correct' },
            { result: 'Incorrect' },
            { result: 'Correct' },
            { result: 'Recorded' }
        ]);
        expect(summary).to.deep.equal({
            captured: 4,
            graded: 3,
            correct: 2,
            incorrect: 1,
            accuracy: 66.7
        });
    });

    it('injects answer reporting without duplicating the instrumentation', () => {
        const html = '<html><body><button class="quiz-option" data-qi="0" data-oi="1">B</button></body></html>';
        const once = injectAnswerTracking(html);
        const twice = injectAnswerTracking(once);
        expect(once).to.include('scorm-ai-answer-reporting-v1');
        expect(once).to.include("cmi.interactions.'+qi+'.result");
        expect(once).to.include("quizmoto.quiz.'+qi+'.");
        expect((twice.match(/scorm-ai-answer-reporting-v1/g) || [])).to.have.length(1);
    });
});
