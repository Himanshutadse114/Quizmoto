const { expect } = require('chai');
const { courseMeta } = require('../utils/scormReportGenerator');
const { learnerOnlyCourseJson } = require('../services/ScormReportService');

describe('SCORM admin preview isolation', () => {
    const learner = {
        id: 'learner-1',
        learnerName: 'Learner One',
        learnerEmail: 'learner@example.com',
        status: 'active',
        isPreview: false,
        lastLessonStatus: 'completed',
        lastScoreRaw: 90,
        lastTotalTime: '00:10:00.00'
    };
    const preview = {
        id: 'preview-1',
        learnerName: 'Host Preview',
        learnerEmail: null,
        status: 'active',
        isPreview: true,
        lastLessonStatus: 'completed',
        lastScoreRaw: 100,
        lastTotalTime: '00:02:00.00'
    };

    it('strips QA preview registrations before either report engine receives data', () => {
        const sanitized = learnerOnlyCourseJson({
            title: 'Course',
            registrations: [learner, preview]
        });
        expect(sanitized.registrations).to.have.length(1);
        expect(sanitized.registrations[0].id).to.equal('learner-1');
    });

    it('never counts or exposes preview registrations in Node report metadata', () => {
        const meta = courseMeta({
            title: 'Course',
            registrations: [learner, preview]
        });
        expect(meta.learners).to.have.length(1);
        expect(meta.learners[0].id).to.equal('learner-1');
        expect(meta.stats.totalLearners).to.equal(1);
        expect(meta.stats.averageScore).to.equal(90);
        expect(meta).not.to.have.property('previews');
    });
});
