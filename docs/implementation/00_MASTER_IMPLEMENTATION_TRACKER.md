# Master Implementation Tracker

| Requirement ID | Phase | Task | Source section | Priority | Status | Files/Modules | Tests | Evidence | Commit/Change Reference | Blocker/Risk | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0-T01–P0-T08 | 0 | Baseline + golden flow | Phase 0 | P0 | **PASSED** | docs, e2e | critical gate | Phase 0 complete | - | None | - |
| P1-T01–P1-T13 | 1 | Harness + extraction | Phase 1 | P1 | **PASSED** | services, tests | critical gate | Phase 1 complete | - | None | READY FOR PHASE 2 |

## Phase 2: Session Engine V2

| Requirement ID | Phase | Task | Source section | Priority | Status | Files/Modules | Tests | Evidence | Commit/Change Reference | Blocker/Risk | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P2-T01 | 2 | Expand GameSession schema | Blueprint §4.2 | P0 | **IMPLEMENTED** | GameSession.js, database.js | fixtures | additive columns | foundation | **User runs npm test** | - |
| P2-T02 | 2 | Round, SessionEvent, IdempotencyRecord | Blueprint §4.4 | P0 | **IMPLEMENTED** (Outbox deferred) | models | fixtures | models registered | foundation | User verifies sync | - |
| P2-T03 | 2 | SessionStateMachine | Blueprint §4.1 | P0 | **IMPLEMENTED** | SessionStateMachine.js | SessionStateMachine.test.js | pure unit | foundation | User runs tests | - |
| P2-T04 | 2 | SessionCommandService | Blueprint §4.3–4.5 | P0 | **IMPLEMENTED** | SessionCommandService.js | SessionCommandService.test.js | pipeline + idempotency | command commits | User runs tests | - |
| P2-T05 | 2 | Command IDs + acks | Blueprint §4.4–4.5 | P0 | **IMPLEMENTED** (flag-gated) | socketSchemas, socketHandlers | socketSchemas.test.js | optional envelope | T05 | User runs tests | - |
| P2-T06 | 2 | Recovery endpoint | Blueprint §4.7 | P0 | **IMPLEMENTED** | routes/sessions.js | sessionsRecovery.test.js | role-safe REST | T06 | User runs tests | - |
| P2-T07 | 2 | Host lease | Blueprint §4.11 | P1 | **IMPLEMENTED** (service) | HostLeaseService.js | HostLeaseService.test.js | acquire/renew/takeover | T07 | Optional: tighter socket wiring | - |
| P2-T08 | 2 | Transient-state watchdog | Blueprint §4.6 | P0 | **IMPLEMENTED** | SessionWatchdogService.js | SessionWatchdogService.test.js | STARTING/LOCKED/FINISHING | T08 | Starts only if flag ON | - |
| P2-T09 | 2 | Client session reducer | Blueprint §3.2 | P1 | **PARTIAL** | client/.../sessionReducer.js | - | pure reducer scaffold; UI not wired | T09 scaffold | Wire pages later | - |
| P2-T10 | 2 | Feature flag | Blueprint §5.5 | P0 | **IMPLEMENTED** | featureFlags.js | default false | gated | foundation | Keep OFF until acceptance | - |
| P2-T11 | 2 | Reliability + golden flow | Blueprint §4.14 | P0 | **NOT VERIFIED** | - | critical gate | awaiting user run | - | **USER ACTION** | Run tests |
| P2-T12 | 2 | Completion report | Governance | P0 | **NOT STARTED** | PHASE_02_COMPLETION_REPORT.md | - | placeholder | - | After T11 green | Fill report |

**Phase 2 exit gate:** not met until P2-T11 evidence exists and P2-T12 is truthful.
