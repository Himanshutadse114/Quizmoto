# Phase 02 Implementation Plan — Session Engine V2

**Phase:** 02  
**Name:** Session Engine V2  
**Status:** PLANNED — AUTHORIZED TO START  
**Date:** 2026-08-03  
**Depends on:** Phase 0 (PASSED), Phase 1 (PASSED — READY FOR PHASE 2)  
**Source:** `Quizmoto_Enhancement_and_Reliability_Blueprint.md` §4, §12 Phase 2  
**Feature flag:** `new_session_engine` (default: **OFF**)

---

## 1. Goal Description

Eliminate stuck and duplicate state transitions. A session must either progress correctly or recover automatically. It must never remain indefinitely on “Starting Session”, silently lose a valid answer, award points twice, or require database surgery after a normal network interruption.

Phase 2 introduces a strict server-side state machine, state versioning, idempotent commands, a canonical recovery endpoint, host lease, and transient-state watchdogs — all behind a disabled-by-default feature flag so existing behaviour is preserved until the acceptance suite is green.

---

## 2. Starting Repository Condition (Verified)

| Item | Current state |
|---|---|
| `GameSession.status` | `ENUM('lobby', 'question', 'result', 'finished')` only |
| State version | **NOT IMPLEMENTED** |
| Round entity | **NOT IMPLEMENTED** (uses `currentQuestionIndex` only) |
| Idempotency records | **NOT IMPLEMENTED** |
| Session event ledger | **NOT IMPLEMENTED** |
| Outbox pattern | **NOT IMPLEMENTED** |
| Canonical recovery REST | Partial (socket recovery via `SessionRecoveryService`) |
| Host lease | **NOT IMPLEMENTED** |
| Transient-state watchdog | **NOT IMPLEMENTED** |
| Client session reducer | Distributed `useState` / page-local state |
| Extracted services (Phase 1) | `ScoringService`, `AnswerSubmissionService`, `SessionRecoveryService`, `SessionTokenService`, Joi schemas |
| Golden flow | Passing (desktop + critical gate) |

---

## 3. Authorized Scope

### In scope

- Additive schema changes to `GameSession` and new tables
- `SessionStateMachine` + `SessionCommandService`
- Command IDs, acknowledgements, expected state versions
- Canonical recovery endpoint
- Host lease fields and takeover rules
- Transient-state watchdog
- Client-side session reducer (behind flag)
- Feature flag wiring
- Reliability acceptance tests
- Documentation updates (tracker, decision log, changelog)

### Out of scope (later phases)

- Redis Streams adapter / multi-node (Phase 3)
- Background job queue for reports (Phase 3)
- Document-to-question generator (Phase 4+)
- New game modes, billing, tenancy, UI redesign
- Renaming existing socket event names used by the live client (preserve compatibility; map internally)
- Destructive removal of legacy status values in this phase (expand-and-contract only)

---

## 4. Target State Machine

Canonical states (blueprint §4.1):

| State | Meaning | Allowed next |
|---|---|---|
| `CREATED` | Session record exists | `LOBBY`, `CANCELLED` |
| `LOBBY` | Players may join | `STARTING`, `CANCELLED` |
| `STARTING` | Start accepted; preparing first round | `QUESTION_COUNTDOWN`, `PAUSED`, `CANCELLED` |
| `QUESTION_COUNTDOWN` | Ready/Set/Go; answers closed | `QUESTION_OPEN`, `PAUSED` |
| `QUESTION_OPEN` | Answers accepted | `QUESTION_LOCKED`, `PAUSED` |
| `QUESTION_LOCKED` | Answers closed; scoring in progress | `ANSWER_REVEAL`, `PAUSED` |
| `ANSWER_REVEAL` | Correct answer shown | `LEADERBOARD`, `NEXT_ROUND_READY`, `FINISHED` |
| `LEADERBOARD` | Round leaderboard | `NEXT_ROUND_READY`, `FINISHED`, `PAUSED` |
| `NEXT_ROUND_READY` | Waiting for host | `QUESTION_COUNTDOWN`, `FINISHED`, `PAUSED` |
| `PAUSED` | Intentional or host-loss pause | recoverable prior, `CANCELLED` |
| `FINISHING` | Final commit in progress | `FINISHED` |
| `FINISHED` | Immutable complete | none |
| `CANCELLED` | Closed without normal completion | none |

**Compatibility mapping (legacy → V2 when flag OFF or during dual-write):**

| Legacy `status` | Maps to |
|---|---|
| `lobby` | `LOBBY` |
| `question` | `QUESTION_OPEN` (approx.; countdown not distinguished) |
| `result` | `ANSWER_REVEAL` / `LEADERBOARD` |
| `finished` | `FINISHED` |

Until flag is enabled for a session, handlers continue using legacy paths.

---

## 5. Authorized Tasks

| ID | Task | Priority | Dependencies |
|---|---|---|---|
| **P2-T01** | Expand `GameSession` schema: `stateVersion`, expanded state fields, timestamps, host lease columns (additive) | P0 | — |
| **P2-T02** | Add tables: `Round`, `SessionEvent`, `IdempotencyRecord`, `OutboxEvent` (models + migrations) | P0 | P2-T01 |
| **P2-T03** | Implement `SessionStateMachine` (pure transition table + validators) | P0 | P2-T01 |
| **P2-T04** | Implement `SessionCommandService` (lock row, validate, transition, persist, outbox) | P0 | P2-T02, P2-T03 |
| **P2-T05** | Command IDs + acknowledgements + `expectedStateVersion` on critical socket commands | P0 | P2-T04 |
| **P2-T06** | Canonical recovery endpoint `GET /api/sessions/:id/recovery` (role-specific, versioned) | P0 | P2-T01, existing `SessionRecoveryService` |
| **P2-T07** | Host lease + takeover rules | P1 | P2-T01 |
| **P2-T08** | Transient-state watchdog for `STARTING`, `QUESTION_LOCKED`, `FINISHING` | P0 | P2-T04 |
| **P2-T09** | Client session reducer / FSM + apply-only-newer-`stateVersion` | P1 | P2-T05, P2-T06 |
| **P2-T10** | Feature flag `new_session_engine` (default OFF) + dual-path handlers | P0 | P2-T04 |
| **P2-T11** | Reliability acceptance suite + golden-flow regression | P0 | All above |
| **P2-T12** | Phase completion report, tracker, security review, rollback notes | P0 | P2-T11 |

---

## 6. Schema Plan (Expand-and-Contract)

### 6.1 `GameSession` additive columns

```text
state                 STRING / ENUM (new canonical values; keep legacy `status` during dual-write)
stateVersion          BIGINT NOT NULL DEFAULT 0
activeRoundId         INTEGER/UUID NULL
stateEnteredAt        DATE NULL
questionOpensAt       DATE NULL
questionClosesAt      DATE NULL
hostLeaseOwner        STRING NULL
hostLeaseExpiresAt    DATE NULL
lastEventSequence     BIGINT NOT NULL DEFAULT 0
recoverySchemaVersion INTEGER NOT NULL DEFAULT 1
lastErrorCode         STRING NULL
```

- Keep existing `status`, `currentQuestionIndex`, `questionStartTime` until cut-over.
- Dual-write: when V2 path runs, update both `status` (legacy mapping) and `state` + `stateVersion`.

### 6.2 New tables

**Round**

```text
id, sessionId, questionIndex, roundId (stable UUID),
opensAt, closesAt, status, createdAt, updatedAt
```

**SessionEvent**

```text
id, sessionId, sequence, eventType, stateVersion, roundId,
actorType, actorId, payloadJson, correlationId, createdAt
```

**IdempotencyRecord**

```text
commandId (unique), actorId, sessionId, commandType,
requestHash, resultCode, resultPayload, createdAt, expiresAt
```

**OutboxEvent** (optional thin table if not folded into SessionEvent)

```text
id, sessionId, eventType, payloadJson, publishedAt, createdAt
```

### 6.3 Answer uniqueness (strengthen)

Prefer unique constraint on `(sessionId, questionIndex, playerId)` or `(sessionId, roundId, playerId)` once `Round` exists. Phase 1 already uses transactional answer insert; Phase 2 hardens the uniqueness rule.

### 6.4 Migration rules

- Additive only in Phase 2 first deploy
- `addColumnIfMissing` / safe ALTER pattern already used in `database.js`
- Rollback: feature flag OFF; columns unused; no destructive DROP in this phase

---

## 7. Module Structure (new / extended)

```text
server/
  services/
    SessionStateMachine.js      # pure transitions
    SessionCommandService.js    # transactional commands
    SessionRecoveryService.js   # extend for schemaVersion + stateVersion
    SessionWatchdogService.js   # transient state scanner
    HostLeaseService.js         # optional thin module
  models/
    GameSession.js              # extended + Round, SessionEvent, IdempotencyRecord
  routes/
    sessions.js                 # recovery endpoint (new or extend quizzes)
  validators/
    socketSchemas.js            # commandId, expectedStateVersion fields
```

Client (flag-gated):

```text
client/src/features/live-session/state/
  sessionReducer.js
  sessionSelectors.js
```

---

## 8. Critical Command Flow (when flag ON)

1. Client sends command with `commandId`, `sessionId`, `expectedStateVersion`
2. Server validates auth, schema, membership
3. Transaction: lock session row → check version → check idempotency → transition via state machine → write Round/Event/Idempotency → dual-write legacy fields → commit
4. Ack with accepted `stateVersion` + result
5. Broadcast versioned event envelope
6. On conflict / stale version → structured error code; client calls recovery

**Start flow (fixes stuck Starting Session):**

1. `START_SESSION` → `STARTING` + version++
2. Ack immediately
3. Prepare first Round → `QUESTION_COUNTDOWN` / open
4. Client + server watchdogs if stuck in `STARTING` > threshold → recovery / pause with `lastErrorCode`

---

## 9. Event Envelope (target)

```json
{
  "eventId": "uuid",
  "eventType": "SESSION_STATE_CHANGED",
  "schemaVersion": 1,
  "sessionId": "...",
  "stateVersion": 42,
  "roundId": "...",
  "serverTime": "ISO-8601",
  "correlationId": "uuid",
  "payload": {}
}
```

Clients ignore events with `stateVersion` ≤ local version; gap → recovery.

---

## 10. Security & Authorization

- Reuse Phase 1 Joi + token services
- Every command: authenticate + authorize role + session membership
- Recovery response role-specific (never leak correct answers pre-reveal to players)
- Rate limits on start/join/answer remain in force
- No tokens in event ledger payloads

---

## 11. Test Plan

### Before changing behaviour
- Characterization tests for current start / answer / reconnect paths
- Golden flow baseline (`npm run test:critical`)

### New tests
- State machine pure unit tests (allowed / forbidden transitions)
- Command idempotency (same `commandId` 20× → one effect)
- Version conflict rejection
- Duplicate answer uniqueness
- Recovery endpoint host vs player payloads
- Watchdog transitions overdue `STARTING`
- Feature flag OFF → legacy behaviour unchanged
- Feature flag ON → new paths + golden flow

### Exit acceptance (blueprint §4.14)
- Host double-starts → one round
- Player double-submits → one answer / one score
- Reconnect during countdown / open / reveal / finish restores correct screen
- No infinite Starting Session under listed scenarios
- Golden flow desktop + mobile viewport still passes

---

## 12. Execution Order

1. **P2-T01 + P2-T02** — Schema foundation (models + safe migrations)
2. **P2-T03** — Pure state machine + unit tests
3. **P2-T10** — Feature flag plumbing (still OFF)
4. **P2-T04 + P2-T05** — Command service + socket ack path behind flag
5. **P2-T06** — Recovery REST
6. **P2-T07 + P2-T08** — Host lease + watchdog
7. **P2-T09** — Client reducer (flag-gated)
8. **P2-T11 + P2-T12** — Full verification + completion report

Each task: Inspect → Plan micro-task → Protect (tests first) → Implement → Verify → Document.

---

## 13. Exit Gate Checklist

Phase 2 is complete only when:

- [ ] All P2-T01…P2-T12 done or explicitly deferred with tracker status
- [ ] Reliability acceptance suite passes
- [ ] No infinite Starting Session in automated scenarios
- [ ] Duplicate commands harmless
- [ ] Golden flow passes with flag OFF (regression)
- [ ] Golden flow passes with flag ON for internal/test sessions
- [ ] `PHASE_02_COMPLETION_REPORT.md` written with truthfulness declaration
- [ ] Master tracker updated
- [ ] Rollback = flag OFF documented and verified

---

## 14. Rollback

1. Set `new_session_engine=false` (env / config) — no code deploy required for emergency disable
2. Legacy `status` path remains authoritative when flag OFF
3. New columns remain unused (safe)
4. Do not DROP columns in emergency rollback

See `PHASE_02_ROLLBACK_PLAN.md`.

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Dual-write drift between `status` and `state` | Single command service writes both; tests assert mapping |
| Client not yet version-aware | Flag OFF by default; recovery endpoint for gaps |
| Migration on SQLite vs Postgres | Use existing `addColumnIfMissing` + dialect branches |
| Scope creep into Redis/jobs | Explicitly out of scope |
| Incomplete cut-over | Exit gate requires both flag paths tested |

---

## 16. First Implementation Step

**Start with P2-T01 + P2-T02:** inspect models, add additive columns and new model definitions, safe migration helpers, and unit/integration tests that prove schema loads on SQLite memory and Postgres without breaking existing tests.

Do not enable the feature flag until command path and acceptance tests exist.
