const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const {
    setProgress,
    getProgress,
    cancelProgress,
    assertNotCancelled,
    failProgress
} = require('../services/scorm/ScormGenerationProgress');

describe('SCORM generation cancellation', () => {
    it('marks an active generation as cancelled and keeps cancellation terminal', () => {
        const id = `cancel_${Date.now()}`;
        const userId = 'cancellation-test-user';
        setProgress(id, userId, { status: 'running', percent: 35, stage: 'Creating visuals' });

        const stopped = cancelProgress(id, userId);
        expect(stopped.status).to.equal('cancelled');
        expect(stopped.stage).to.equal('Generation stopped');
        expect(stopped.cancelledAt).to.be.greaterThan(0);

        // Late provider callbacks must not revive a stopped job.
        setProgress(id, userId, { status: 'running', percent: 70, stage: 'Still working' });
        failProgress(id, userId, new Error('late failure'));
        const current = getProgress(id, userId);
        expect(current.status).to.equal('cancelled');
        expect(current.percent).to.equal(35);
        expect(() => assertNotCancelled(id, userId)).to.throw().with.property('code', 'SCORM_GENERATION_CANCELLED');
    });

    it('exposes a protected cancel endpoint and client stop/remove controls', () => {
        const author = fs.readFileSync(path.join(__dirname, '../routes/scorm/author.js'), 'utf8');
        const jobs = fs.readFileSync(path.join(__dirname, '../../client/src/services/courseGenerationJobs.js'), 'utf8');
        const panel = fs.readFileSync(path.join(__dirname, '../../client/src/components/BackgroundCourseJobs.jsx'), 'utf8');

        expect(author).to.include("router.post('/progress/:progressId/cancel', auth");
        expect(author).to.include('checkpoint(progressId, req.userId)');
        expect(jobs).to.include('cancelCourseGenerationJob');
        expect(jobs).to.include('removeCourseGenerationJob');
        expect(panel).to.include("'Stop'");
        expect(panel).to.include('Remove');
    });
});
