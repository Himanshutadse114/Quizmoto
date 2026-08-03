# Master Implementation Tracker

| Phase | Status |
|---|---|
| Phase 0 | **PASSED** |
| Phase 1 | **PASSED** |
| Phase 2 | **IN PROGRESS** — code complete for T01–T11 suite; exit gate pending operator evidence + T12 |

## Phase 2 tasks

| ID | Task | Status |
|---|---|---|
| P2-T01 | Schema | **IMPLEMENTED** |
| P2-T02 | Round/Event/Idempotency | **IMPLEMENTED** |
| P2-T03 | State machine | **IMPLEMENTED** |
| P2-T04 | Command service | **IMPLEMENTED** |
| P2-T05 | commandId + acks | **IMPLEMENTED** (flag-gated) |
| P2-T06 | Recovery REST | **IMPLEMENTED** |
| P2-T07 | Host lease | **IMPLEMENTED** |
| P2-T08 | Watchdog | **IMPLEMENTED** |
| P2-T09 | Client FSM module | **IMPLEMENTED** (opt-in; pages unchanged) |
| P2-T10 | Feature flags | **IMPLEMENTED** (default OFF) |
| P2-T11 | Reliability suite | **SUITE ADDED** — operator must run `npm test` + `test:critical` |
| P2-T12 | Completion report | **NEXT** after you paste test results |

## Commands for you

```bash
cd server && npm test
cd server && npm run test:reliability
# repo root:
npm run test:critical
```

Live: keep `NEW_SESSION_ENGINE` unset/false.
