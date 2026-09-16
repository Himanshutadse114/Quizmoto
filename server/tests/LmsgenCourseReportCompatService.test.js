const { expect } = require('chai');
const { learnerRows } = require('../services/scorm/LmsgenCourseReportCompatService');

describe('LMSGEN course report compatibility', () => {
    it('preserves per-slide timing evidence for PDF and Excel reports', () => {
        const rows = learnerRows({
            learners: [{
                learnerName: 'Himanshu',
                learnerEmail: 'learner@example.com',
                result: 'Completed',
                progressPercent: 100,
                totalTime: '00:00:56.07',
                slideTimings: [
                    { slideNumber: 1, label: 'Slide 1', timeSpent: '00:00:12.40', milliseconds: 12400, visits: 2, status: 'Viewed' },
                    { slideNumber: 2, label: 'Slide 2', timeSpent: '00:00:00.00', milliseconds: 0, visits: 0, status: 'Not visited' }
                ]
            }]
        });

        expect(rows).to.have.length(1);
        expect(rows[0].slideTimings).to.deep.equal([
            { slideNumber: 1, label: 'Slide 1', timeSpent: '00:00:12.40', milliseconds: 12400, visits: 2, status: 'Viewed' },
            { slideNumber: 2, label: 'Slide 2', timeSpent: '00:00:00.00', milliseconds: 0, visits: 0, status: 'Not visited' }
        ]);
    });
});
