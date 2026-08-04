const { expect } = require('chai');
const Metrics = require('../utils/metrics');

describe('Metrics hooks (P3-T09)', () => {
    beforeEach(() => {
        Metrics.reset();
    });

    it('increments counters', () => {
        Metrics.inc('http.requests');
        Metrics.inc('http.requests', 2);
        const snap = Metrics.snapshot();
        expect(snap.counters['http.requests']).to.equal(3);
    });

    it('records gauges', () => {
        Metrics.setQueueDepth(4);
        expect(Metrics.snapshot().gauges['jobs.queue_depth']).to.equal(4);
    });

    it('summarizes timings with avg and p95', () => {
        for (const ms of [10, 20, 30, 40, 50]) {
            Metrics.timing('jobs.duration_ms', ms);
        }
        const t = Metrics.snapshot().timings['jobs.duration_ms'];
        expect(t.count).to.equal(5);
        expect(t.min).to.equal(10);
        expect(t.max).to.equal(50);
        expect(t.avg).to.equal(30);
        expect(t.p95).to.be.a('number');
    });

    it('recordHttp buckets status codes', () => {
        Metrics.recordHttp(200, 15);
        Metrics.recordHttp(404, 5);
        Metrics.recordHttp(500, 100);
        const c = Metrics.snapshot().counters;
        expect(c['http.requests']).to.equal(3);
        expect(c['http.status.2xx']).to.equal(1);
        expect(c['http.status.4xx']).to.equal(1);
        expect(c['http.status.5xx']).to.equal(1);
    });

    it('recordJobCompleted tracks duration by type', () => {
        Metrics.recordJobCompleted('REPORT_PDF', 120);
        const snap = Metrics.snapshot();
        expect(snap.counters['jobs.completed']).to.equal(1);
        expect(snap.counters['jobs.completed.REPORT_PDF']).to.equal(1);
        expect(snap.timings['jobs.duration_ms'].count).to.equal(1);
        expect(snap.timings['jobs.duration_ms.REPORT_PDF'].avg).to.equal(120);
    });

    it('recordReportLatency tracks format', () => {
        Metrics.recordReportLatency('pdf', 250);
        const snap = Metrics.snapshot();
        expect(snap.counters['reports.generated']).to.equal(1);
        expect(snap.timings['reports.latency_ms'].avg).to.equal(250);
    });

    it('snapshot includes service metadata', () => {
        const snap = Metrics.snapshot();
        expect(snap.startedAt).to.be.a('string');
        expect(snap.collectedAt).to.be.a('string');
        expect(snap.env).to.be.a('string');
    });
});
