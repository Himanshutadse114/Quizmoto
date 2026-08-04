/**
 * Phase 3 (P3-T09) — basic in-process metrics hooks.
 *
 * Tracks counters, gauges, and timing samples for:
 * - job duration / outcomes
 * - queue depth
 * - HTTP request counts and latency
 * - report latency (when callers record it)
 *
 * Export via Metrics.snapshot() or GET /api/metrics (optional METRICS_TOKEN).
 * Not a full APM — hooks only, process-local, reset on restart.
 */

const MAX_SAMPLES = 200;

/** @type {Map<string, number>} */
const counters = new Map();
/** @type {Map<string, number>} */
const gauges = new Map();
/** @type {Map<string, number[]>} */
const timings = new Map();

const startedAt = new Date().toISOString();

function inc(name, by = 1) {
    const key = String(name);
    counters.set(key, (counters.get(key) || 0) + by);
}

function gauge(name, value) {
    gauges.set(String(name), Number(value));
}

function timing(name, durationMs) {
    const key = String(name);
    const ms = Number(durationMs);
    if (!Number.isFinite(ms) || ms < 0) return;
    let arr = timings.get(key);
    if (!arr) {
        arr = [];
        timings.set(key, arr);
    }
    arr.push(ms);
    if (arr.length > MAX_SAMPLES) {
        arr.splice(0, arr.length - MAX_SAMPLES);
    }
}

function summarize(samples) {
    if (!samples || samples.length === 0) {
        return { count: 0, min: null, max: null, avg: null, p95: null };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95Index = Math.min(count - 1, Math.floor(count * 0.95));
    return {
        count,
        min: sorted[0],
        max: sorted[count - 1],
        avg: Math.round((sum / count) * 100) / 100,
        p95: sorted[p95Index]
    };
}

function snapshot() {
    const counterObj = {};
    for (const [k, v] of counters.entries()) counterObj[k] = v;

    const gaugeObj = {};
    for (const [k, v] of gauges.entries()) gaugeObj[k] = v;

    const timingObj = {};
    for (const [k, samples] of timings.entries()) {
        timingObj[k] = summarize(samples);
    }

    return {
        service: process.env.LOG_SERVICE || 'quizmoto-server',
        env: process.env.NODE_ENV || 'development',
        startedAt,
        collectedAt: new Date().toISOString(),
        counters: counterObj,
        gauges: gaugeObj,
        timings: timingObj
    };
}

/** Reset all metrics (tests only). */
function reset() {
    counters.clear();
    gauges.clear();
    timings.clear();
}

// --- domain helpers ---

function recordHttp(statusCode, durationMs) {
    inc('http.requests');
    const bucket = statusCode >= 500 ? '5xx' : statusCode >= 400 ? '4xx' : '2xx';
    inc(`http.status.${bucket}`);
    timing('http.duration_ms', durationMs);
}

function recordJobEnqueued(type) {
    inc('jobs.enqueued');
    if (type) inc(`jobs.enqueued.${type}`);
}

function recordJobCompleted(type, durationMs) {
    inc('jobs.completed');
    if (type) inc(`jobs.completed.${type}`);
    timing('jobs.duration_ms', durationMs);
    if (type) timing(`jobs.duration_ms.${type}`, durationMs);
}

function recordJobFailed(type, durationMs) {
    inc('jobs.failed');
    if (type) inc(`jobs.failed.${type}`);
    if (durationMs != null) timing('jobs.duration_ms', durationMs);
}

function recordReportLatency(format, durationMs) {
    inc('reports.generated');
    if (format) inc(`reports.generated.${format}`);
    timing('reports.latency_ms', durationMs);
    if (format) timing(`reports.latency_ms.${format}`, durationMs);
}

function setQueueDepth(depth) {
    gauge('jobs.queue_depth', depth);
}

const Metrics = {
    inc,
    gauge,
    timing,
    snapshot,
    reset,
    recordHttp,
    recordJobEnqueued,
    recordJobCompleted,
    recordJobFailed,
    recordReportLatency,
    setQueueDepth
};

module.exports = Metrics;
