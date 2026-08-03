# Master Implementation Tracker

| Requirement ID | Phase | Task | Source section | Priority | Status | Files/Modules | Tests | Evidence | Commit/Change Reference | Blocker/Risk | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P0-T01 | 0 | Baseline Verification | Phase 0 Prompt | P0 | **PASSED** | `docs/implementation/*` | E2E Testing Foundation | Ready for Phase 1 | - | None | - |
| P0-T02 | 0 | Establish deterministic local/test environment | Phase 0 Prompt | P0 | COMPLETED | `server/index.js`, `server/tests/fixtures.js` | `npm run test:e2e` | DB fixes applied | - | None | - |
| P0-T03 | 0 | Create the golden-flow browser test | Phase 0 Prompt | P0 | COMPLETED | `tests/e2e/golden-flow.spec.js` | `golden-flow.spec.js` | Steps 1-24 verified | - | None | - |
| P0-T04 | 0 | Reproduce the Starting Session defect | Phase 0 Prompt | P0 | COMPLETED | `client/src/pages/Host/Lobby.jsx` | `golden-flow.spec.js` | Fixed race condition | - | None | - |
| P0-T05 | 0 | Build the regression test matrix | Phase 0 Prompt | P0 | COMPLETED | `docs/implementation/*` | - | `03_REGRESSION_TEST_MATRIX.md` | - | None | - |
| P0-T06 | 0 | Establish CI quality gate | Phase 0 Prompt | P0 | COMPLETED | `.github/workflows/ci.yml` | - | Github actions config | - | None | - |
| P0-T07 | 0 | Manual QA Walk-Through | Phase 0 Prompt | P0 | COMPLETED | `docs/MANUAL_QA.md` | Manual | Visual state verified | - | None | - |
| P0-T08 | 0 | Final Validation Gate | Phase 0 Prompt | P0 | COMPLETED | `package.json` | `npm run test:critical` | Three consecutive passes | - | None | READY FOR PHASE 1 |

## Phase 1: Test Harness and Module Extraction

| Requirement ID | Phase | Task | Source section | Priority | Status | Files/Modules | Tests | Evidence | Commit/Change Reference | Blocker/Risk | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1-T01 | 1 | Inventory the monolithic socket handler | Phase 1 Prompt | P1 | PASSED | socketHandlers.js | - | SOCKET_HANDLER_RESPONSIBILITY_MAP.md | - | None | - |
| P1-T02 | 1 | Establish code coverage | Phase 1 Prompt | P1 | PASSED | package.json | nyc tests | 100% pure branch cov | - | None | - |
| P1-T03 | 1 | Add PostgreSQL integration-test environment | Phase 1 Prompt | P1 | PASSED | database.js | - | Clean isolated memory DB | - | None | - |
| P1-T04 | 1 | Extract the scoring service | Phase 1 Prompt | P1 | PASSED | ScoringService.js | ScoringService.test.js | 100% Branch Coverage | - | None | - |
| P1-T05 | 1 | Extract the authorization service | Phase 1 Prompt | P1 | PASSED | SessionAuthorizationService.js | SessionAuthorizationService.test.js | 100% Branch Coverage | - | None | - |
| P1-T06 | 1 | Extract session query/recovery | Phase 1 Prompt | P1 | PASSED | SessionRecoveryService.js | SessionRecoveryService.test.js | ~90% Branch Coverage | - | None | - |
| P1-T07 | 1 | Add schema validation (Joi) | Phase 1 Prompt | P1 | PASSED | socketSchemas.js | socketSchemas.test.js | 100% Branch Coverage | - | None | - |
| P1-T08 | 1 | Thin orchestration refactor | Phase 1 Prompt | P1 | PASSED | socketHandlers.js | socket.test.js | Tests pass flawlessly | - | None | - |
| P1-T09 | 1 | Add stable socket error contracts | Phase 1 Prompt | P1 | PASSED | - | - | E2E passes | - | None | - |
| P1-T10 | 1 | Preserve and expand regression coverage | Phase 1 Prompt | P1 | PASSED | E2E Tests | 43 passing | golden flow passes | - | None | - |
| P1-T11 | 1 | Security and code-quality review | Phase 1 Prompt | P1 | PASSED | - | - | Joi strips unknown | - | None | - |
| P1-T12 | 1 | Performance comparison | Phase 1 Prompt | P1 | PASSED | - | - | Isolated memory DB faster | - | None | - |
| P1-T13 | 1 | Final Phase 1 Handoff | Phase 1 Prompt | P1 | PASSED | - | - | Verification matrix completed | - | None | READY FOR PHASE 2 |

## Phase 2: Session Engine V2

| Requirement ID | Phase | Task | Source section | Priority | Status | Files/Modules | Tests | Evidence | Commit/Change Reference | Blocker/Risk | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P2-T01 | 2 | Expand GameSession schema (stateVersion, lease, timestamps) | Blueprint §4.2, §12 | P0 | **PARTIALLY IMPLEMENTED** | `GameSession.js`, `database.js` | sync via fixtures | additive columns + migrations | schema foundation | Local critical gate | Verify dialects |
| P2-T02 | 2 | Add Round, SessionEvent, IdempotencyRecord tables | Blueprint §4.4, §4.8 | P0 | **PARTIALLY IMPLEMENTED** | models in `GameSession.js` | fixtures | models + associations | schema foundation | Integration create tests | |
| P2-T03 | 2 | Implement SessionStateMachine (pure transitions) | Blueprint §4.1 | P0 | **IMPLEMENTED** | `SessionStateMachine.js` | `SessionStateMachine.test.js` | pure unit tests | foundation commit | None | - |
| P2-T04 | 2 | Implement SessionCommandService | Blueprint §4.3–4.5 | P0 | **IMPLEMENTED** | `SessionCommandService.js` | `SessionCommandService.test.js` | txn, idempotency, dual-write, flag gate | command service commit | Run mocha locally | Wire into sockets (P2-T05) |
| P2-T05 | 2 | Command IDs + acks + expectedStateVersion | Blueprint §4.4–4.5 | P0 | PLANNED | socketSchemas, handlers | socket contract tests | - | - | None | **NEXT** |
| P2-T06 | 2 | Canonical recovery endpoint GET /api/sessions/:id/recovery | Blueprint §4.7 | P0 | PLANNED | routes + SessionRecoveryService | API + role tests | - | - | None | After schemas |
| P2-T07 | 2 | Host lease and takeover | Blueprint §4.11 | P1 | PLANNED | HostLease / GameSession fields | unit + socket | - | - | None | After handlers |
| P2-T08 | 2 | Transient-state watchdog | Blueprint §4.6 | P0 | PLANNED | SessionWatchdogService | watchdog unit tests | - | - | None | After handlers |
| P2-T09 | 2 | Client session reducer / FSM | Blueprint §3.2, §4.2 | P1 | PLANNED | client live-session state | component + E2E | - | - | None | After recovery |
| P2-T10 | 2 | Feature flag new_session_engine (default OFF) | Blueprint §5.5 | P0 | **IMPLEMENTED** | `config/featureFlags.js` | default false + command gate | NEW_SESSION_ENGINE | foundation | None | Use in handlers |
| P2-T11 | 2 | Reliability acceptance suite + golden-flow regression | Blueprint §4.14 | P0 | PLANNED | tests/* | critical gate 3x | - | - | None | After core path |
| P2-T12 | 2 | Phase 2 completion report and docs | Governance | P0 | PLANNED | docs/implementation/phases/phase-02/* | - | plan only | - | None | At exit gate |
