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
| P1-T01–P1-T13 | 1 | (see prior rows; all PASSED) | Phase 1 | P1 | **PASSED** | services, tests | critical gate | Phase 1 handoff | - | None | READY FOR PHASE 2 |

## Phase 2: Session Engine V2

| Requirement ID | Phase | Task | Source section | Priority | Status | Files/Modules | Tests | Evidence | Commit/Change Reference | Blocker/Risk | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P2-T01 | 2 | Expand GameSession schema | Blueprint §4.2 | P0 | **PARTIALLY IMPLEMENTED** | GameSession.js, database.js | fixtures sync | additive columns | foundation | Local critical gate | Verify dialects |
| P2-T02 | 2 | Round, SessionEvent, IdempotencyRecord | Blueprint §4.4 | P0 | **PARTIALLY IMPLEMENTED** | models | fixtures | registered | foundation | Create integration | |
| P2-T03 | 2 | SessionStateMachine | Blueprint §4.1 | P0 | **IMPLEMENTED** | SessionStateMachine.js | SessionStateMachine.test.js | pure unit | foundation | None | - |
| P2-T04 | 2 | SessionCommandService | Blueprint §4.3–4.5 | P0 | **IMPLEMENTED** | SessionCommandService.js | SessionCommandService.test.js | pipeline + idempotency | command commits | Local mocha | - |
| P2-T05 | 2 | Command IDs + acks + expectedStateVersion | Blueprint §4.4–4.5 | P0 | **IMPLEMENTED** (flag-gated) | socketSchemas.js, socketHandlers.js | socketSchemas.test.js + command tests | optional envelope; V2 only if NEW_SESSION_ENGINE + commandId | T05 commits | **Run `npm test` + golden flow flag OFF** | P2-T06 recovery |
| P2-T06 | 2 | Canonical recovery endpoint | Blueprint §4.7 | P0 | PLANNED | routes | API tests | - | - | None | **NEXT** |
| P2-T07 | 2 | Host lease | Blueprint §4.11 | P1 | PLANNED | - | - | - | - | None | After recovery |
| P2-T08 | 2 | Transient-state watchdog | Blueprint §4.6 | P0 | PLANNED | - | - | - | - | None | After recovery |
| P2-T09 | 2 | Client session reducer | Blueprint §3.2 | P1 | PLANNED | - | - | - | - | None | After server stable |
| P2-T10 | 2 | Feature flag NEW_SESSION_ENGINE | Blueprint §5.5 | P0 | **IMPLEMENTED** | featureFlags.js | default false | gated in handlers | foundation | None | - |
| P2-T11 | 2 | Reliability suite + golden flow | Blueprint §4.14 | P0 | **NOT VERIFIED** | - | critical gate | - | - | None | After T06–T08 |
| P2-T12 | 2 | Completion report | Governance | P0 | PLANNED | phase-02/* | - | plan only | - | None | At exit |
