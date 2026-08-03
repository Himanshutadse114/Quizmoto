# Phase 03 Progress

**Updated:** 2026-08-04

| ID | Task | Status |
|----|------|--------|
| P3-T01 | Postgres production posture | **DONE** |
| P3-T02 | Redis adapter hardening | NOT STARTED |
| P3-T03 | Multi-node / sticky notes | NOT STARTED |
| P3-T04 | Queue + worker foundation | **DONE** |
| P3-T05 | Async reports (wire routes + real Python) | **IMPLEMENTED** — flag OFF keeps sync path |
| P3-T06 | Object storage abstraction | **NEXT** |
| P3-T07 | Backup / restore runbook | NOT STARTED |
| P3-T08 | Structured logging | NOT STARTED |
| P3-T09 | Metrics hooks | NOT STARTED |
| P3-T10 | REPORTS_ASYNC flag | **DONE** (default OFF) |
| P3-T11 | Acceptance tests | PARTIAL (queue + async report tests) |
| P3-T12 | Completion report | NOT STARTED |

## P3-T05 notes

- `ReportGenerationService` shared by sync HTTP and worker handlers
- `REPORTS_ASYNC=false` (default): same download behaviour as before
- `REPORTS_ASYNC=true`: `202` + `jobId`; poll `GET /api/jobs/:id`; download `GET /api/jobs/:id/download`
- `REPORTS_PROCESS_INLINE=1` processes job in API process (tests / single-box without worker)
- Worker: `npm run worker` for production async
