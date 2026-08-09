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
                interactionsJson: JSON.stringify([{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]),
                rawMapJson: '{}',
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

    it('normalizes scores when a custom min/max range is supplied', () => {
        expect(scorePercent(40, 20, 60)).to.equal(50);
        expect(scorePercent(75, null, null)).to.equal(75);
    });

    it('counts array and object interaction payloads safely', () => {
        expect(interactionCount('[{"id":1},{"id":2}]')).to.equal(2);
        expect(interactionCount('{"q1":{},"q2":{},"q3":{}}')).to.equal(3);
        expect(interactionCount('not-json')).to.equal(0);
    });
});
