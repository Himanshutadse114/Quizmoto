# Phase 03 Implementation Plan — Production Infrastructure and Background Jobs

**Phase:** 03  
**Name:** Production Infrastructure and Background Jobs  
**Status:** PLANNED — AUTHORIZED TO START  
**Date:** 2026-08-03  
**Depends on:** Phase 0–2 **PASSED** (Session Engine V2 delivered; flag OFF)  
**Source:** `Quizmoto_Enhancement_and_Reliability_Blueprint.md` §12 Phase 3  
**Feature flags (proposed):** `REPORTS_ASYNC` (default OFF), optional `SOCKET_REDIS_ADAPTER` (env-driven)

---

## 1. Goal

Separate **live play** from **heavy work** and prepare for revenue-grade operations.

- Live quiz latency must not depend on report generation, PDF/Excel export, or bulk I/O.
- Production source of truth remains **PostgreSQL**.
- Optional horizontal scale for Socket.IO via Redis adapter when multi-node is required.
- Durable jobs for reports (and later imports/exports).
- Backups, structured logs, and basic operational metrics.

**Does not** enable Session Engine V2 in production. Phase 2 flag stays **OFF** unless separately authorized.

---

## 2. Starting Repository Condition (Verified from Phase 0–2 work)

| Item | Current state |
|------|----------------|
| Production DB intent | Postgres supported; SQLite still used for local/default tests |
| Socket.IO Redis adapter | **Partial** — optional `REDIS_URL` in `server/index.js` |
| Sticky sessions / multi-node test | **NOT IMPLEMENTED** as formal test |
| Job queue / workers | **NOT IMPLEMENTED** |
| Report generation | **In-process** (Node → Python script for PDF; Excel in process) |
| Object storage | **NOT IMPLEMENTED** (local `data/tmp` paths) |
| Backup / restore drill | **NOT DOCUMENTED** as automated procedure |
| Structured logs / metrics / alerts | **Partial** — ad-hoc `console.log` / `logDiag`; no metrics pipeline |
| Phase 2 session engine | **Implemented**, default **OFF** |

---

## 3. Authorized Scope

### In scope

| ID | Task | Priority |
|----|------|----------|
| **P3-T01** | Production Postgres posture: document + enforce prod dialect checks; no silent SQLite in production | P0 |
| **P3-T02** | Redis Socket.IO adapter hardening (optional, env-gated) + connection health logs | P1 |
| **P3-T03** | Multi-node / sticky-session notes + minimal dual-process smoke test plan | P1 |
| **P3-T04** | Durable job queue foundation (BullMQ or equivalent on Redis) + worker entrypoint | P0 |
| **P3-T05** | Move report PDF/Excel generation to async worker; API returns job id | P0 |
| **P3-T06** | Object storage abstraction for report artifacts (local disk + S3-compatible interface) | P1 |
| **P3-T07** | Backup and restore runbook + scripted drill for Postgres | P0 |
| **P3-T08** | Structured logging (JSON) for request/socket/job lifecycle | P1 |
| **P3-T09** | Basic metrics hooks (job duration, queue depth, report latency) — exportable | P2 |
| **P3-T10** | Feature flag `REPORTS_ASYNC` default OFF; legacy sync path preserved | P0 |
| **P3-T11** | Acceptance tests: worker failure, API non-blocking, flag OFF regression | P0 |
| **P3-T12** | Phase completion report + tracker update | P0 |

### Out of scope (later phases)

- Document-to-question generator (Phase 4+)
- Enabling `NEW_SESSION_ENGINE` in production
- Billing, tenancy, marketplace
- Full APM product integration (Datadog/etc.) — hooks only
- Rewriting all socket handlers

---

## 4. Architecture Target (incremental)

```text
[Client] → [API / Socket] → [PostgreSQL]     live path (unchanged latency budget)
                │
                ├─ enqueue report job → [Redis queue] → [Worker process]
                │                              │
                │                              └→ storage (local or S3)
                │
                └─ optional Socket.IO Redis adapter (multi-node only)
```

**Rules:**

1. Live `start_question` / `submit_answer` / `end_question` must never await PDF generation.
2. When `REPORTS_ASYNC=false`, existing sync report routes keep working.
3. When `REPORTS_ASYNC=true`, export endpoints enqueue and return `202` + `jobId`.
4. Worker crashes must not corrupt session rows; jobs are idempotent by `jobId` / report key.

---

## 5. Task Details

### P3-T01 — Postgres production posture

- Document: production **must** set `DB_DIALECT=postgres`.
- On `NODE_ENV=production`, refuse to start if dialect is sqlite (hard fail with clear message).
- Update `.env.example` and deployment notes (`render.yaml` / Docker) if needed.
- Tests: unit assert boot guard behaviour under mock env.

### P3-T02 — Redis adapter hardening

- Existing optional adapter stays env-gated on `REDIS_URL`.
- Add structured log on connect/fail; do not crash server if Redis optional and reports flag off.
- Document when Redis is **required** (multi-node or async reports).

### P3-T03 — Multi-node / sticky sessions

- Document sticky session requirement for non-adapter deployments.
- Minimal test or script outline: two server processes + Redis adapter smoke (manual or automated if feasible in CI).

### P3-T04 — Queue + worker foundation

- Introduce worker package path e.g. `server/worker.js` or `server/jobs/`.
- Use Redis-backed queue (prefer **BullMQ** if dependency approved; else document alternative).
- Job types: `REPORT_PDF`, `REPORT_EXCEL` initially.
- Idempotency: same report request key does not double-generate unnecessarily.

### P3-T05 — Async reports

- Extract current report generation from request path into job handler.
- API: enqueue when flag ON; poll/status endpoint `GET /api/jobs/:id` or report status on existing reports route.
- Keep sync path when flag OFF.

### P3-T06 — Object storage abstraction

- Interface: `putObject`, `getObjectUrl` / stream, `deleteObject`.
- Default implementation: local filesystem under `server/data/artifacts/`.
- Optional S3-compatible when `S3_BUCKET` + credentials present.

### P3-T07 — Backup / restore

- Runbook: `pg_dump` / `pg_restore` steps for staging.
- Script under `scripts/` for dump + restore dry-run against test Postgres when available.
- Document RPO/RTO targets as **aspirational** until measured.

### P3-T08 / P3-T09 — Observability

- JSON log helper for HTTP, socket, job start/end/fail.
- Counters/timers in-memory or Redis for queue depth and job duration (export later).

### P3-T10 — Feature flag

- `REPORTS_ASYNC` default **false** in `featureFlags.js`.
- Env: `REPORTS_ASYNC=true` to enable.

### P3-T11 — Acceptance

- Flag OFF: existing report tests still pass.
- Flag ON (test env with Redis): enqueue returns quickly; worker produces file; failure is visible on job status.
- Live socket golden flow / unit suite still green with flag OFF.

### P3-T12 — Completion report

- Same structure as Phase 2 completion report + truthfulness declaration.

---

## 6. Execution Order

1. **P3-T01** — Prod Postgres guard (small, safe)
2. **P3-T10** — Feature flag plumbing
3. **P3-T04** — Queue + worker skeleton
4. **P3-T05** — Async reports behind flag
5. **P3-T06** — Storage abstraction
6. **P3-T02 / T03** — Redis / multi-node docs + hardening
7. **P3-T07** — Backup runbook
8. **P3-T08 / T09** — Logging / metrics hooks
9. **P3-T11 / T12** — Tests + completion

---

## 7. Exit Gate (blueprint)

Phase 3 is complete only when:

- [ ] Backend restart and worker failure behaviour tested (documented evidence)
- [ ] Reports do not block live request path when async flag ON
- [ ] Sync path still works when flag OFF
- [ ] Restore procedure documented and drill evidence exists (or honest BLOCKED if no Postgres CI)
- [ ] Golden flow / unit suite still pass with production-like defaults (flags OFF)
- [ ] `PHASE_03_COMPLETION_REPORT.md` complete with truthfulness declaration

---

## 8. Rollback

1. Set `REPORTS_ASYNC=false` — sync reports restored.
2. Stop worker process — no effect on live play.
3. Unset `REDIS_URL` if adapter issues — single-node sockets only.
4. Do not DROP job tables without backup in emergency (prefer disable worker).

See `PHASE_03_ROLLBACK_PLAN.md`.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Redis required for async reports | Flag OFF by default; document Redis as dependency when enabling |
| Python PDF still fragile | Worker isolates failures; job status surfaces error |
| Scope creep into Phase 4 generator | Explicitly out of scope |
| Multi-node without sticky sessions | Document + adapter requirement |

---

## 10. First Implementation Step

**Start with P3-T01 only:** production dialect guard + `.env.example` / docs notes + unit test.  
Do not introduce the queue until T01 and T10 flag plumbing are in place.
