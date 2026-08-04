/**
 * Phase 3 acceptance (P3-T11)
 *
 * Exit-gate checks:
 * - REPORTS_ASYNC defaults OFF (sync path preserved)
 * - Worker failure is visible on job status (no silent hang)
 * - Enqueue is non-blocking; processJob is explicit
 * - Metrics + logger modules load and record without throwing
 * - Production guards still refuse sqlite in production
 */

const { expect } = require('chai');
const JobQueueService = require('../jobs/JobQueueService');
const { JOB_TYPES, JOB_STATUS } = require('../jobs/jobTypes');
const { featureFlags } = require('../config/featureFlags');
const { assertProductionDatabase } = require('../config/productionGuards');
const Metrics = require('../utils/metrics');
const logger = require('../utils/logger');

describe('Phase 3 Acceptance (P3-T11)', function () {
    this.timeout(10000);

    beforeEach(() => {
        JobQueueService._resetForTests();
        Metrics.reset();
    });

    describe('Flag OFF regression', () => {
        it('REPORTS_ASYNC defaults to false', () => {
            // Ensure env does not force ON for this assertion
            const prev = process.env.REPORTS_ASYNC;
            delete process.env.REPORTS_ASYNC;
            delete require.cache[require.resolve('../config/featureFlags')];
            const { featureFlags: flags } = require('../config/featureFlags');
            expect(flags.reportsAsync).to.equal(false);
            if (prev !== undefined) process.env.REPORTS_ASYNC = prev;
            else delete process.env.REPORTS_ASYNC;
            delete require.cache[require.resolve('../config/featureFlags')];
        });

        it('NEW_SESSION_ENGINE remains default false (Phase 2 not auto-enabled)', () => {
            expect(featureFlags.newSessionEngine).to.equal(false);
        });
    });

    describe('Worker failure behaviour', () => {
        it('failed handler marks job FAILED with error message', async () => {
            JobQueueService.registerHandler(JOB_TYPES.REPORT_PDF, async () => {
                throw new Error('simulated worker crash');
            });

            const job = await JobQueueService.enqueue({
                type: JOB_TYPES.REPORT_PDF,
                payload: { sessionId: 1, hostId: 1 },
                actorId: '1'
            });

            const outcome = await JobQueueService.processJob(job.id);
            expect(outcome.ok).to.equal(false);
            expect(outcome.code).to.equal('FAILED');
            expect(outcome.job.status).to.equal(JOB_STATUS.FAILED);
            expect(outcome.job.error).to.match(/simulated worker crash/);

            const loaded = await JobQueueService.getJob(job.id);
            expect(loaded.status).to.equal(JOB_STATUS.FAILED);
            expect(loaded.error).to.match(/simulated worker crash/);
        });

        it('missing handler fails job without throwing out of processJob', async () => {
            // no handler registered for REPORT_EXCEL in this test
            const job = await JobQueueService.enqueue({
                type: JOB_TYPES.REPORT_EXCEL,
                payload: { sessionId: 1, hostId: 1 }
            });
            const outcome = await JobQueueService.processJob(job.id);
            expect(outcome.ok).to.equal(false);
            expect(outcome.code).to.equal('NO_HANDLER');
            expect(outcome.job.status).to.equal(JOB_STATUS.FAILED);
        });
    });

    describe('API non-blocking queue path', () => {
        it('enqueue returns quickly without running handler', async () => {
            let handlerRan = false;
            JobQueueService.registerHandler(JOB_TYPES.REPORT_PDF, async () => {
                handlerRan = true;
                await new Promise((r) => setTimeout(r, 2000));
                return { ok: true };
            });

            const t0 = Date.now();
            const job = await JobQueueService.enqueue({
                type: JOB_TYPES.REPORT_PDF,
                payload: { sessionId: 5, hostId: 1 }
            });
            const elapsed = Date.now() - t0;

            expect(job.status).to.equal(JOB_STATUS.PENDING);
            expect(handlerRan).to.equal(false);
            // enqueue must not wait for handler
            expect(elapsed).to.be.below(500);
        });

        it('processJob completes successfully and is idempotent on second call', async () => {
            JobQueueService.registerHandler(JOB_TYPES.REPORT_PDF, async (payload) => ({
                ok: true,
                sessionId: payload.sessionId
            }));

            const job = await JobQueueService.enqueue({
                type: JOB_TYPES.REPORT_PDF,
                payload: { sessionId: 11, hostId: 1 }
            });

            const first = await JobQueueService.processJob(job.id);
            expect(first.ok).to.equal(true);
            expect(first.job.status).to.equal(JOB_STATUS.COMPLETED);

            const second = await JobQueueService.processJob(job.id);
            expect(second.ok).to.equal(true);
            expect(second.code).to.equal('ALREADY_COMPLETED');
        });
    });

    describe('Observability hooks', () => {
        it('metrics record job lifecycle', async () => {
            JobQueueService.registerHandler(JOB_TYPES.REPORT_PDF, async () => ({ ok: true }));

            const job = await JobQueueService.enqueue({
                type: JOB_TYPES.REPORT_PDF,
                payload: { sessionId: 1, hostId: 1 }
            });
            await JobQueueService.processJob(job.id);

            const snap = Metrics.snapshot();
            expect(snap.counters['jobs.enqueued']).to.be.at.least(1);
            expect(snap.counters['jobs.completed']).to.be.at.least(1);
            expect(snap.timings['jobs.duration_ms']).to.be.an('object');
        });

        it('logger helpers do not throw', () => {
            expect(() => logger.info('acceptance_ping', { module: 'test' })).to.not.throw();
            expect(() => logger.job('job_processed', { jobId: 'x' })).to.not.throw();
            expect(() =>
                logger.http({ method: 'GET', url: '/health' }, { statusCode: 200 }, 1)
            ).to.not.throw();
        });
    });

    describe('Production guards still active', () => {
        it('rejects production sqlite', () => {
            const prevEnv = process.env.NODE_ENV;
            const prevDialect = process.env.DB_DIALECT;
            process.env.NODE_ENV = 'production';
            process.env.DB_DIALECT = 'sqlite';
            expect(() => assertProductionDatabase()).to.throw(/postgres|dialect|sqlite/i);
            process.env.NODE_ENV = prevEnv;
            if (prevDialect === undefined) delete process.env.DB_DIALECT;
            else process.env.DB_DIALECT = prevDialect;
        });
    });
});
