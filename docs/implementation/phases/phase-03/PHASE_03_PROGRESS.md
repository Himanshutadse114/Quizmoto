# Phase 03 Progress

**Updated:** 2026-08-04

| ID | Task | Status |
|----|------|--------|
| P3-T01 | Postgres production posture | **DONE** |
| P3-T02 | Redis adapter hardening | NOT STARTED |
| P3-T03 | Multi-node / sticky notes | NOT STARTED |
| P3-T04 | Queue + worker foundation | **IMPLEMENTED** — memory + optional Redis; report handlers stub |
| P3-T05 | Async reports (wire routes + real Python) | **NEXT** |
| P3-T06 | Object storage abstraction | NOT STARTED |
| P3-T07 | Backup / restore runbook | NOT STARTED |
| P3-T08 | Structured logging | NOT STARTED |
| P3-T09 | Metrics hooks | NOT STARTED |
| P3-T10 | REPORTS_ASYNC flag | **DONE** (default OFF) |
| P3-T11 | Acceptance tests | PARTIAL (queue unit tests) |
| P3-T12 | Completion report | NOT STARTED |

## P3-T04 notes

- `server/jobs/JobQueueService.js` — enqueue / dequeue / process / idempotency
- `server/worker.js` — `npm run worker`
- Handlers for `REPORT_PDF` / `REPORT_EXCEL` are **stubs** until T05
- **No change** to report HTTP routes yet (sync path unchanged)
- No new npm dependencies (uses existing `redis` only when `REDIS_URL` set)
