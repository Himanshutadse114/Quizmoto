const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
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

    it('renders each learner summary directly before that learner slide evidence', () => {
        const generator = fs.readFileSync(path.join(__dirname, '../utils/lmsgen_report_premium.py'), 'utf8');
        expect(generator).to.include('for i,row in enumerate(rows,1):');
        expect(generator).to.include('story += [learner_card(row,i,s),Spacer(1,2*mm)]');
        expect(generator).to.include('timing_heading,timing_table=slide_timing_table(row,s)');
        expect(generator).to.not.include("section('03','SLIDE-LEVEL EVIDENCE'");
    });
});
