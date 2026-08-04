# Phase 03 — Redis Adapter & Multi-Node Notes (P3-T02 / P3-T03)

**Status:** DONE (documentation + existing env-gated code)  
**Date:** 2026-08-04

---

## P3-T02 — Redis Socket.IO adapter

### Behaviour (already in `server/index.js`)

- Adapter is **optional** and enabled only when `REDIS_URL` is set.
- On connect success: structured log `socket_redis_adapter_connected`.
- On failure: structured log `socket_redis_adapter_failed`; **server continues** without adapter (single-node sockets).
- Job queue (`JobQueueService`) independently uses `REDIS_URL` when present; otherwise memory backend.

### When Redis is required

| Scenario | Redis needed? |
|----------|----------------|
| Single web dyno, `REPORTS_ASYNC=false` | No |
| Single web dyno, `REPORTS_ASYNC=true` + inline process in API | No (but not recommended for prod) |
| Separate worker process + async reports | **Yes** (`REDIS_URL` shared by API and worker) |
| Multiple web nodes (horizontal scale) | **Yes** (Socket.IO adapter + sticky sessions or adapter) |

### Env

```text
REDIS_URL=redis://...   # optional; omit for single-node memory queue
REPORTS_ASYNC=false     # keep OFF in production until worker is deployed
```

### Hardening checklist

- [x] Env-gated; no crash if Redis down when optional
- [x] Structured connect/fail logs (P3-T08 logger)
- [ ] Operator sets `REDIS_URL` on Render Redis add-on before enabling `REPORTS_ASYNC`

---

## P3-T03 — Multi-node / sticky sessions

### Rules

1. **Without** Socket.IO Redis adapter: load balancer **must** use sticky sessions (session affinity) so a client’s socket always hits the same Node process.
2. **With** Redis adapter: sticky sessions still recommended for HTTP session cookies, but socket rooms work across nodes via the adapter.
3. Live play (`start_question` / `submit_answer` / `end_question`) must never depend on the report worker process being up.

### Minimal dual-process smoke (manual)

1. Start Redis locally or use a managed instance.
2. Terminal A: `REDIS_URL=... node server/index.js` (or `npm start` from `server/`).
3. Terminal B: `REDIS_URL=... node server/worker.js`.
4. Set `REPORTS_ASYNC=true` only on the API process for a staging test.
5. Host a short game on a single node (flag OFF) — play must work even if worker is stopped.
6. With flag ON, request a report export → `202` + `jobId` → worker completes → `GET /api/jobs/:id` shows `completed`.

### CI note

Automated dual-process smoke is **not** required for Phase 3 exit if staging evidence is documented. Unit/acceptance tests cover queue failure and flag OFF without Redis.

---

## Rollback

1. `REPORTS_ASYNC=false`
2. Stop worker
3. Unset `REDIS_URL` if adapter misbehaves → single-node only
