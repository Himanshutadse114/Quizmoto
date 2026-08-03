# Phase 02 Progress Notes

**Updated:** 2026-08-03

## Implemented (code present; local verification pending)

| ID | Item | Notes |
|---|---|---|
| P2-T01 | GameSession additive schema | Columns present; dual-write used by command service |
| P2-T02 | Round / SessionEvent / IdempotencyRecord | OutboxEvent deferred (optional) |
| P2-T03 | SessionStateMachine | Pure unit tests |
| P2-T04 | SessionCommandService | Pipelines + idempotency |
| P2-T05 | commandId / acks | Optional schema fields; V2 only if flag + commandId |
| P2-T06 | GET /api/sessions/:id/recovery | Role-safe REST |
| P2-T07 | HostLeaseService | Acquire/renew/takeover/release; wired optionally via service |
| P2-T08 | SessionWatchdogService | STARTING→PAUSED, LOCKED→REVEAL, FINISHING→FINISHED; started from index when flag ON |
| P2-T09 | sessionReducer.js | Pure client reducer scaffold; **not wired into UI pages yet** |
| P2-T10 | NEW_SESSION_ENGINE | Default OFF |

## Not complete

- P2-T09 full UI integration
- P2-T11 reliability suite + golden flow evidence (you will run)
- P2-T12 formal completion report with truthfulness after your test run

## Default safety

`NEW_SESSION_ENGINE` defaults **false**. Production behaviour remains legacy until explicitly enabled.
