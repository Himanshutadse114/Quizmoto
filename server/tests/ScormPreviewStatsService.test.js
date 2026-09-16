const { expect } = require('chai');
const {
    serializePreviewStats,
    scorePercent,
    interactionCount,
    liveInteractionScore,
    slideTimingRows,
    hasElapsedTime
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
        expect(result.currentRunTime).to.equal('00:02:14.00');
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

    it('derives a live provisional QA score from captured interaction results before Finish', () => {
        const registration = {
            id: 'preview-live-score',
            courseId: 'course-live-score',
            status: 'active',
            isPreview: true,
            lastLessonStatus: 'incomplete',
            lastScoreRaw: 0,
            updatedAt: '2026-08-26T08:45:00.000Z',
            learningStateV2: {
                lessonStatus: 'incomplete',
                scoreRaw: 0,
                lessonLocation: '4',
                totalTime: '00:02:00.00',
                progressPercent: 40,
                sequence: 5,
                values: {
                    'cmi.core.lesson_location': '4',
                    'cmi.core.lesson_status': 'incomplete',
                    'cmi.interactions.0.id': 'quiz_1',
                    'cmi.interactions.0.result': 'correct',
                    'cmi.interactions.1.id': 'quiz_2',
                    'cmi.interactions.1.result': 'correct'
                }
            }
        };
        const course = {
            title: 'Security Essentials',
            package: {
                analysisJson: JSON.stringify({
                    slides: [{ title: 'Intro' }],
                    quiz: [{}, {}, {}, {}]
                })
            }
        };

        const result = serializePreviewStats(registration, course);

        expect(result.interactionCount).to.equal(2);
        expect(result.scoreRaw).to.equal(50);
        expect(result.scorePercent).to.equal(50);
    });

    it('keeps an explicit SCORM score authoritative over a provisional interaction score', () => {
        const state = {
            scoreRaw: 0,
            values: {
                'cmi.core.score.raw': '75',
                'cmi.interactions.0.result': 'correct',
                'cmi.interactions.1.result': 'wrong'
            }
        };
        const course = { package: { analysisJson: JSON.stringify({ quiz: [{}, {}] }) } };

        expect(liveInteractionScore(state, course)).to.equal(50);

        const result = serializePreviewStats({
            id: 'preview-explicit-score',
            courseId: 'course-explicit-score',
            status: 'active',
            isPreview: true,
            learningStateV2: state
        }, course);

        expect(result.scoreRaw).to.equal(75);
        expect(result.scorePercent).to.equal(75);
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

    it('returns per-slide dwell time and visit counts for admin preview', () => {
        const state = {
            values: {
                'cmi.interactions.0.id': 'slide_1',
                'cmi.interactions.0.type': 'other',
                'cmi.interactions.0.description': 'Slide 1 viewing time',
                'cmi.interactions.0.student_response': 'viewed',
                'cmi.interactions.0.latency': '0000:00:12.50',
                'quizmoto.slide_time.0.milliseconds': '12500',
                'quizmoto.slide_time.0.visits': '2',
                'cmi.interactions.1.id': 'slide_2',
                'cmi.interactions.1.type': 'other',
                'cmi.interactions.1.description': 'Slide 2 viewing time',
                'cmi.interactions.1.student_response': 'skipped',
                'cmi.interactions.1.latency': '0000:00:00.80',
                'quizmoto.slide_time.1.milliseconds': '800',
                'quizmoto.slide_time.1.visits': '1'
            }
        };

        expect(slideTimingRows(state, null)).to.deep.equal([
            {
                slideNumber: 1,
                label: 'Slide 1 viewing time',
                timeSpent: '0000:00:12.50',
                milliseconds: 12500,
                visits: 2,
                status: 'Viewed'
            },
            {
                slideNumber: 2,
                label: 'Slide 2 viewing time',
                timeSpent: '0000:00:00.80',
                milliseconds: 800,
                visits: 1,
                status: 'Skipped'
            }
        ]);
    });

    it('uses cumulative time only when the current QA session has no elapsed time yet', () => {
        expect(hasElapsedTime('00:00:00.00')).to.equal(false);
        expect(hasElapsedTime('PT0S')).to.equal(false);
        expect(hasElapsedTime('00:11:18.00')).to.equal(true);

        const result = serializePreviewStats({
            id: 'preview-time-fallback',
            courseId: 'course-time-fallback',
            status: 'active',
            isPreview: true,
            cmiState: {
                totalTime: '00:04:30.00',
                sessionTime: '00:00:00.00',
                rawMapJson: '{}'
            }
        }, { package: { analysisJson: '{}' } });

        expect(result.currentRunTime).to.equal('00:04:30.00');
    });

    it('lists every presentation slide from saved timing arrays when interaction rows are absent', () => {
        const packageRow = {
            analysisJson: JSON.stringify({
                courseMode: 'presentation',
                presentation: { slideCount: 3 }
            })
        };
        const state = {
            suspendData: JSON.stringify({
                slideTimesMs: [5200, 700, 0],
                slideVisits: [1, 1, 0]
            }),
            values: {}
        };

        expect(slideTimingRows(state, packageRow)).to.deep.equal([
            { slideNumber: 1, label: 'Slide 1', timeSpent: null, milliseconds: 5200, visits: 1, status: 'Viewed' },
            { slideNumber: 2, label: 'Slide 2', timeSpent: null, milliseconds: 700, visits: 1, status: 'Skipped' },
            { slideNumber: 3, label: 'Slide 3', timeSpent: null, milliseconds: 0, visits: 0, status: 'Not visited' }
        ]);
    });
});
