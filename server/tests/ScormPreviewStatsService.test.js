const { expect } = require('chai');
const {
    serializePreviewStats,
    scorePercent,
    interactionCount
} = require('../services/scorm/ScormPreviewStatsService');

describe('SCORM admin preview stats', () => {
    it('serializes QA score, progress, location, time and interactions without making it learner data', () => {
        const registration = {
            id: 'preview-1',
            courseId: 'course-1',
            status: 'active',
            isPreview: true,
            lastLessonStatus: 'passed',
            lastScoreRaw: 88,
            lastTotalTime: '00:07:42.00',
            lastCommitAt: '2026-08-09T07:00:00.000Z',
            updatedAt: '2026-08-09T07:00:00.000Z',
            cmiState: {
                initialized: true,
                lessonStatus: 'passed',
                scoreRaw: 88,
                scoreMin: 0,
                scoreMax: 100,
                lessonLocation: '3',
                totalTime: '00:07:42.00',
                sessionTime: '00:02:14.00',
                interactionsJson: null,
                rawMapJson: JSON.stringify({
                    'cmi.interactions.0.id': 'quiz_1',
                    'cmi.interactions.0.result': 'correct',
                    'cmi.interactions.1.id': 'quiz_2',
                    'cmi.interactions.1.result': 'wrong',
                    'cmi.interactions.2.id': 'quiz_3',
                    'cmi.interactions.2.result': 'correct'
                }),
                stateVersion: 9
            }
        };
        const course = {
            title: 'Security Essentials',
            status: 'draft',
            inviteCode: 'ABC123',
            package: {
                analysisJson: JSON.stringify({
                    slides: [{ title: 'Intro' }, { title: 'Threats' }, { title: 'Response' }],
                    quiz: [{}, {}]
                })
            }
        };

        const result = serializePreviewStats(registration, course);

        expect(result.isPreview).to.equal(true);
        expect(result.qaState).to.equal('passed');
        expect(result.scoreRaw).to.equal(88);
        expect(result.scorePercent).to.equal(88);
        expect(result.progressPercent).to.equal(100);
        expect(result.totalTime).to.equal('00:07:42.00');
        expect(result.sessionTime).to.equal('00:02:14.00');
        expect(result.lastLocation).to.equal('Response');
        expect(result.interactionCount).to.equal(3);
        expect(result.stateVersion).to.equal(9);
    });

    it('prefers v2 learner state over stale legacy preview state', () => {
        const registration = {
            id: 'preview-v2',
            courseId: 'course-v2',
            status: 'active',
            isPreview: true,
            lastLessonStatus: 'incomplete',
            lastScoreRaw: 50,
            lastCommitAt: '2026-08-09T14:00:00.000Z',
            updatedAt: '2026-08-09T14:00:00.000Z',
            cmiState: {
                initialized: false,
                lessonStatus: 'not attempted',
                scoreRaw: null,
                scoreMin: null,
                scoreMax: null,
                lessonLocation: null,
                totalTime: null,
                rawMapJson: '{}',
                stateVersion: 0
            },
            learningStateV2: {
                lessonStatus: 'incomplete',
                scoreRaw: 50,
                lessonLocation: '3',
                suspendData: JSON.stringify({ quizmotoSlide: 3, quizmotoProgress: 50 }),
                totalTime: '00:03:15.00',
                progressPercent: 0,
                sequence: 7,
                values: {
                    'cmi.core.score.raw': '50',
                    'cmi.core.lesson_location': '3',
                    'cmi.core.lesson_status': 'incomplete',
                    'cmi.core.session_time': '00:00:20.00',
                    'cmi.suspend_data': JSON.stringify({ quizmotoSlide: 3, quizmotoProgress: 50 }),
                    'cmi.interactions.0.id': 'quiz_1',
                    'cmi.interactions.0.result': 'correct'
                }
            }
        };
        const course = {
            title: 'Security Essentials',
            status: 'draft',
            inviteCode: 'ABC123',
            package: {
                analysisJson: JSON.stringify({
                    slides: [{ title: 'Intro' }, { title: 'Threats' }, { title: 'Response' }],
                    quiz: [{}, {}]
                })
            }
        };

        const result = serializePreviewStats(registration, course);

        expect(result.qaState).to.equal('in progress');
        expect(result.progressPercent).to.equal(50);
        expect(result.progressAvailable).to.equal(true);
        expect(result.lessonStatus).to.equal('incomplete');
        expect(result.lastLocation).to.equal('Response');
        expect(result.totalTime).to.equal('00:03:15.00');
        expect(result.sessionTime).to.equal('00:00:20.00');
        expect(result.scoreRaw).to.equal(50);
        expect(result.scoreMax).to.equal(null);
        expect(result.interactionCount).to.equal(1);
        expect(result.stateVersion).to.equal(7);
    });

    it('normalizes scores when a custom min/max range is supplied', () => {
        expect(scorePercent(40, 20, 60)).to.equal(50);
        expect(scorePercent(75, null, null)).to.equal(75);
    });

    it('counts interaction payloads from the legacy column when present', () => {
        expect(interactionCount('[{"id":1},{"id":2}]')).to.equal(2);
        expect(interactionCount('{"q1":{},"q2":{},"q3":{}}')).to.equal(3);
    });

    it('counts unique cmi.interactions indices from the actual runtime raw map', () => {
        const rawMap = JSON.stringify({
            'cmi.interactions.0.id': 'quiz_1',
            'cmi.interactions.0.type': 'choice',
            'cmi.interactions.0.result': 'correct',
            'cmi.interactions.1.id': 'quiz_2',
            'cmi.interactions.1.result': 'wrong',
            'cmi.core.lesson_location': '4'
        });
        expect(interactionCount(null, rawMap)).to.equal(2);
        expect(interactionCount('not-json', rawMap)).to.equal(2);
    });

    it('returns zero for malformed or empty interaction state', () => {
        expect(interactionCount('not-json')).to.equal(0);
        expect(interactionCount(null, 'not-json')).to.equal(0);
        expect(interactionCount(null, '{}')).to.equal(0);
    });
});
