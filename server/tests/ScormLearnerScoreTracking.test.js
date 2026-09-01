const { expect } = require('chai');
const {
    serializeRegistration,
    liveInteractionScore
} = require('../services/scorm/ScormProgressService');
const { registrationProgress, mergeCanonicalState } = require('../services/scorm/ScormCanonicalProgressService');

describe('learner score tracking', () => {
    const packageRow = {
        analysisJson: JSON.stringify({
            slides: [{ title: 'Intro' }, { title: 'Threats' }],
            quiz: [{}, {}, {}, {}]
        })
    };

    it('derives a live score from quiz interaction results before Finish', () => {
        const state = {
            lessonStatus: 'incomplete',
            scoreRaw: null,
            values: {
                'cmi.interactions.0.result': 'correct',
                'cmi.interactions.1.result': 'wrong',
                'quizmoto.quiz.0.result': 'correct'
            }
        };
        expect(liveInteractionScore(state, packageRow)).to.equal(25);
    });

    it('serializes that live score onto the course activity row', () => {
        const row = serializeRegistration({
            id: 'reg-score',
            status: 'invited',
            lastLessonStatus: null,
            lastScoreRaw: null,
            learningStateV2: {
                lessonStatus: 'incomplete',
                scoreRaw: null,
                lessonLocation: '4',
                sequence: 6,
                values: {
                    'cmi.core.lesson_status': 'incomplete',
                    'cmi.core.lesson_location': '4',
                    'cmi.interactions.0.result': 'correct',
                    'cmi.interactions.1.result': 'correct'
                }
            }
        }, { title: 'Protecting Against Social Engineering Attacks', package: packageRow });

        expect(row.lastScoreRaw).to.equal(50);
        expect(row.score).to.equal(50);
        expect(row.lastLessonStatus).to.equal('incomplete');
        expect(row.progressPercent).to.be.greaterThan(0);
    });

    it('merges a runtime snapshot when v2 state is empty so played scores still surface', () => {
        const merged = mergeCanonicalState(null, {
            lessonStatus: 'incomplete',
            scoreRaw: 80,
            lessonLocation: '5',
            stateVersion: 4,
            rawMapJson: JSON.stringify({
                'cmi.core.score.raw': '80',
                'cmi.core.lesson_status': 'incomplete',
                'cmi.interactions.0.result': 'correct',
                'cmi.interactions.1.result': 'correct',
                'cmi.interactions.2.result': 'correct',
                'cmi.interactions.3.result': 'wrong'
            })
        });
        const progress = registrationProgress({ status: 'invited' }, merged);
        expect(progress.status).to.equal('in_progress');
        expect(progress.score).to.equal(80);
        expect(progress.lessonStatus).to.equal('incomplete');
    });
});
