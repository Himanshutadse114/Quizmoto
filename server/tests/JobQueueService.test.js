const { expect } = require('chai');
const JobQueueService = require('../jobs/JobQueueService');
const { JOB_TYPES, JOB_STATUS } = require('../jobs/jobTypes');
const { featureFlags } = require('../config/featureFlags');

describe('JobQueueService (Phase 3 foundation)', function () {
    this.timeout(10000);

    beforeEach(() => {
        JobQueueService._resetForTests();
        // Minimal handler — full report path covered in reports.async.test.js
        JobQueueService.registerHandler(JOB_TYPES.REPORT_PDF, async (payload) => {
            if (!payload.sessionId) throw new Error('sessionId is required in report job payload');
            return { ok: true, sessionId: payload.sessionId, format: 'pdf' };
        });
        JobQueueService.registerHandler(JOB_TYPES.REPORT_EXCEL, async (payload) => {
            if (!payload.sessionId) throw new Error('sessionId is required in report job payload');
            return { ok: true, sessionId: payload.sessionId, format: 'excel' };
        });
    });

    it('REPORTS_ASYNC remains default false (flag does not auto-enable queue path)', () => {
        expect(featureFlags.reportsAsync).to.equal(false);
    });

    it('enqueues a job and returns pending status', async () => {
        const job = await JobQueueService.enqueue({
            type: JOB_TYPES.REPORT_PDF,
            payload: { sessionId: 42, format: 'pdf' },
            actorId: '1'
        });

        expect(job.id).to.be.a('string');
        expect(job.status).to.equal(JOB_STATUS.PENDING);
        expect(job.type).to.equal(JOB_TYPES.REPORT_PDF);

        const loaded = await JobQueueService.getJob(job.id);
        expect(loaded.status).to.equal(JOB_STATUS.PENDING);
    });

    it('idempotency key returns the same non-failed job', async () => {
        const key = 'report:session:99:pdf';
        const first = await JobQueueService.enqueue({
            type: JOB_TYPES.REPORT_PDF,
            payload: { sessionId: 99 },
            idempotencyKey: key
        });
        const second = await JobQueueService.enqueue({
            type: JOB_TYPES.REPORT_PDF,
            payload: { sessionId: 99 },
            idempotencyKey: key
        });

        expect(second.id).to.equal(first.id);
        expect(second.replay).to.equal(true);
        expect(JobQueueService._memoryQueueLength()).to.equal(1);
    });

    it('processJob runs registered handler and marks completed', async () => {
        const job = await JobQueueService.enqueue({
            type: JOB_TYPES.REPORT_EXCEL,
            payload: { sessionId: 7, format: 'excel' }
        });

        const outcome = await JobQueueService.processJob(job.id);
        expect(outcome.ok).to.equal(true);
        expect(outcome.code).to.equal('COMPLETED');
        expect(outcome.job.status).to.equal(JOB_STATUS.COMPLETED);
        expect(outcome.job.result.sessionId).to.equal(7);
    });

    it('processJob fails when sessionId missing', async () => {
        const job = await JobQueueService.enqueue({
            type: JOB_TYPES.REPORT_PDF,
            payload: {}
        });
        const outcome = await JobQueueService.processJob(job.id);
        expect(outcome.ok).to.equal(false);
        expect(outcome.job.status).to.equal(JOB_STATUS.FAILED);
        expect(outcome.job.error).to.match(/sessionId/);
    });

    it('dequeue returns enqueued job id in FIFO order', async () => {
        const a = await JobQueueService.enqueue({
            type: JOB_TYPES.REPORT_PDF,
            payload: { sessionId: 1 }
        });
        const b = await JobQueueService.enqueue({
            type: JOB_TYPES.REPORT_PDF,
            payload: { sessionId: 2 }
        });

        const first = await JobQueueService.dequeue(0);
        const second = await JobQueueService.dequeue(0);
        expect(first).to.equal(a.id);
        expect(second).to.equal(b.id);
    });

    it('rejects enqueue without type', async () => {
        try {
            await JobQueueService.enqueue({ payload: {} });
            expect.fail('should throw');
        } catch (err) {
            expect(err.code).to.equal('JOB_VALIDATION');
        }
    });
});
