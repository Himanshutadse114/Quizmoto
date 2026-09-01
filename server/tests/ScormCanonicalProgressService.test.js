const { expect } = require('chai');
const {
    effectiveLessonStatus,
    effectiveProgressPercent,
    registrationProgress
} = require('../services/scorm/ScormCanonicalProgressService');

describe('ScormCanonicalProgressService', () => {
    it('uses canonical SCORM 1.2 completion even when registration projection is stale', () => {
        const registration = {
            status: 'invited',
            lastLessonStatus: null,
            lastCommitAt: null
        };
        const state = {
            lessonStatus: 'passed',
            progressPercent: 100,
            sequence: 7,
            updatedAt: new Date().toISOString(),
            values: {
                'cmi.core.lesson_status': 'passed',
                'cmi.core.score.raw': '85'
            },
            scoreRaw: 85
        };

        const progress = registrationProgress(registration, state);
        expect(progress.status).to.equal('completed');
        expect(progress.lessonStatus).to.equal('passed');
        expect(progress.progressPercent).to.equal(100);
        expect(progress.score).to.equal(85);
    });

    it('does not let a SCORM 1.2 placeholder mask SCORM 2004 completion', () => {
        const state = {
            lessonStatus: 'not attempted',
            values: {
                'cmi.core.lesson_status': 'not attempted',
                'cmi.completion_status': 'completed',
                'cmi.progress_measure': '1'
            }
        };

        expect(effectiveLessonStatus(state)).to.equal('completed');
        expect(effectiveProgressPercent(state)).to.equal(100);
        expect(registrationProgress({ status: 'invited' }, state).status).to.equal('completed');
    });

    it('reports partial canonical progress as in progress', () => {
        const state = {
            lessonStatus: 'incomplete',
            progressPercent: 42,
            sequence: 3,
            updatedAt: new Date().toISOString(),
            values: {
                'cmi.core.lesson_status': 'incomplete'
            }
        };

        const progress = registrationProgress({ status: 'invited' }, state);
        expect(progress.status).to.equal('in_progress');
        expect(progress.progressPercent).to.equal(42);
    });

    it('recovers Quizmoto progress from suspend data when no progress field was projected', () => {
        const state = {
            lessonStatus: 'incomplete',
            values: {
                'cmi.core.lesson_status': 'incomplete',
                'cmi.suspend_data': JSON.stringify({ quizmotoProgress: 67 })
            }
        };

        expect(effectiveProgressPercent(state)).to.equal(67);
    });
});
