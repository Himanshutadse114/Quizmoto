# Quizmoto / Kahoot Awareness
## Product Enhancement, Reliability and Revenue Blueprint

**Prepared for implementation in Antigravity**  
**Date:** 2 August 2026  
**Source reviewed:** `PROJECT_DOCUMENTATION.md`  
**Document status:** Implementation blueprint, not a claim that every recommendation is already present in the repository

---

# Executive Summary

Quizmoto already has a strong base: real-time multiplayer play, host and player authentication, QR joining, server-controlled timers, scoring, reconnect support, team mode, reactions, analytics, report exports, Docker deployment, and optional AI-assisted quiz creation. The existing project documentation also correctly identifies the database as the intended source of truth and includes some protection against duplicate joins, repeated answers, and rapid host actions.

The next step should **not** be to add every feature immediately. The product should first become difficult to break. The recommended order is:

1. **Stabilize the session engine.** Replace loosely coordinated status changes with a strict state machine, state versioning, idempotent commands, acknowledgements, recovery snapshots, and watchdogs.
2. **Create an automated regression safety net.** Every change must run unit, integration, socket, multi-player, reconnection, and browser tests before it can be merged or deployed.
3. **Separate background work.** Report generation, document parsing, imports, exports, notifications, and large question-generation jobs should run through a durable job queue instead of inside web request processes.
4. **Build a deterministic document-to-question engine.** It can generate good extractive questions without paid AI by using document parsing, rule-based patterns, keyword scoring, controlled distractors, quality scoring, and mandatory review for low-confidence questions.
5. **Expand the question platform.** Add a large, structured, versioned question bank with parameterized generators for mathematics and aptitude, editorial workflows, licensing/source metadata, and difficulty calibration.
6. **Add learning and commercial layers.** Self-paced assignments, course paths, mastery, certificates, institution workspaces, white-labeling, subscriptions, marketplace features, and APIs can then be built safely.

A deterministic algorithm can reduce AI cost substantially, but it should not be marketed internally as equal to a generative model for every kind of document. It will work best for factual, definition-based, numerical, list, sequence, comparison, and cause-effect content. A hybrid design is strongest: rules first, local processing second, optional paid AI only for low-confidence or advanced questions.

---

# 1. Current Project Assessment

## 1.1 Confirmed strengths from the supplied documentation

The supplied project documentation describes the following mature capabilities:

- React/Vite frontend with separate host and player flows.
- Express and Socket.IO backend for REST and real-time communication.
- Sequelize models for users, quizzes, questions, sessions, players, and answers.
- Server-controlled timers and server-side score calculation.
- Player reconnection using a session-scoped JWT and database-backed player records.
- Host reconnection and waiting overlays for players.
- Duplicate nickname handling, answer-spam protection, and atomic score increments.
- QR joining, team mode, reactions, sounds, animations, leaderboards, analytics, and PDF/Excel reports.
- Optional Redis adapter support and Docker/Nginx deployment support.
- Gemini-based quiz generation.

These are meaningful foundations. The product is no longer a simple prototype; it should now be managed as a stateful, revenue-critical application.

## 1.2 Risks visible from the documented architecture

The following are **architecture risks inferred from the documentation** and should be verified against the actual repository before implementation:

| Risk | Why it matters | Priority |
|---|---|---:|
| Large central `socketHandlers.js` | A single file containing authentication, state transitions, scoring, persistence, and broadcasts becomes fragile and difficult to test. | P0 |
| Status values are too broad | `lobby`, `question`, `result`, and `finished` do not describe countdown, locking, pausing, recovery, or transition-in-progress states. | P0 |
| Socket events are treated as commands and state | If an event is missed, retried, duplicated, or arrives during reconnect, the UI can become stuck or inconsistent. | P0 |
| Client state is recreated from a “massive state object” | Without schema versioning and explicit state versions, old clients or partially updated components may misread recovery data. | P0 |
| SQLite remains supported for production | SQLite is useful locally but is a poor target for multi-instance, high-concurrency production gameplay. | P0 |
| Report generation uses direct child processes | CPU-heavy or failed Python processes can affect API responsiveness and are difficult to retry safely. | P1 |
| JWTs are stored in `localStorage` | XSS can expose long-lived tokens. Host authentication should move toward secure, HttpOnly cookie-based sessions or a hardened short-lived access/refresh design. | P1 |
| Free-tier keep-alive is part of production behavior | A revenue product should use production infrastructure with predictable uptime, health checks, logs, backups, and scaling. | P1 |
| No documented CI quality gate | Features can break unrelated flows when there is no automated “must pass” release pipeline. | P0 |
| No event ledger or command idempotency | Duplicate starts, submissions, finishes, exports, or XP awards may occur under retry and reconnect conditions. | P0 |
| No documented multi-tenant boundary | Institution features and commercial plans will require strict organization-level authorization and data isolation. | P1 |

## 1.3 The immediate product objective

The immediate goal should be:

> A session must either progress correctly or recover automatically. It must never remain indefinitely on “starting,” silently lose a valid answer, award points twice, or require database surgery after a normal network interruption.

---

# 2. Target Product Vision

Quizmoto should evolve into a complete **live learning, assessment, practice, and content platform** with four product surfaces:

1. **Live Play** - host-led multiplayer quizzes, competitions, classroom sessions, events, and awareness campaigns.
2. **Independent Learning** - assignments, practice, flashcards, revision, courses, certificates, and mastery paths.
3. **Content Engine** - manual creation, document import, deterministic generation, optional AI generation, question banks, templates, and marketplace content.
4. **Institution Platform** - organizations, teachers, classes, roles, analytics, integrations, branding, billing, APIs, and governance.

## 2.1 Architecture principles

Antigravity should follow these principles for every implementation:

- **Server authoritative:** The client displays state; it does not decide the canonical state, score, timer, or eligibility.
- **One state transition path:** All session transitions must go through a single domain service.
- **Every command is idempotent:** Retrying the same command must not create a different result.
- **Every state has a version:** Clients ignore older state and request recovery when versions skip.
- **Events are facts, not instructions:** `QuestionStarted` describes what happened; it is not the only place the state exists.
- **Database writes and event publication are coordinated:** Use an outbox/event log pattern so committed state is not separated from broadcasts.
- **Background jobs are durable:** Reports and imports can retry without harming the final state.
- **Feature flags protect releases:** New functionality can be enabled gradually and disabled without emergency code changes.
- **Backward-compatible deployment:** Database and event changes should support rolling upgrades.
- **Observability is a feature:** Every failed transition should be diagnosable from a correlation ID and structured logs.
- **Security by default:** Strict origin validation, authorization per message, rate limits, payload schemas, token rotation, and least privilege.
- **Accessible and mobile-first:** Gameplay should work with keyboard, screen readers, reduced motion, low bandwidth, and small screens.

---

# 3. Required Architecture Refactor

## 3.1 Recommended backend module structure

Do not continue placing new behavior into one socket handler file. Refactor incrementally:

```text
server/src/
  app.js
  server.js
  config/
  domain/
    session/
      SessionStateMachine.js
      SessionCommandService.js
      SessionQueryService.js
      SessionRecoveryService.js
      SessionAuthorization.js
      SessionErrors.js
    scoring/
      ScoringEngine.js
      StreakPolicy.js
    content/
      QuizService.js
      QuestionValidationService.js
    document-generation/
      DocumentIngestionService.js
      QuestionExtractionPipeline.js
      DistractorService.js
      QualityScorer.js
  realtime/
    socketServer.js
    middleware/
    handlers/
      hostHandlers.js
      playerHandlers.js
      reactionHandlers.js
    eventPublisher.js
    eventSchemas.js
  repositories/
  jobs/
    queues.js
    workers/
      reportWorker.js
      documentWorker.js
      importWorker.js
  api/
    routes/
    controllers/
    validators/
  observability/
    logger.js
    metrics.js
    tracing.js
  tests/
```

The first refactor should preserve behavior. Move code behind tests before changing logic.

## 3.2 Recommended frontend module structure

```text
client/src/
  app/
  features/
    live-session/
      api/
      socket/
      state/
        sessionReducer.js
        sessionSelectors.js
      screens/
      components/
    quiz-authoring/
    document-import/
    reports/
    billing/
  shared/
    components/
    hooks/
    validation/
    telemetry/
```

Use a reducer or finite-state machine for the live session UI. Do not distribute the same session status across several independent `useState` variables.

## 3.3 Recommended production data services

- **PostgreSQL:** canonical application and session data.
- **Redis:** ephemeral coordination, rate limits, queues, session recovery adapter, and distributed locks/leases where needed.
- **Object storage:** uploaded documents, question images, report files, and exports.
- **Job workers:** report generation, document parsing, bulk imports, email, certificates, and scheduled tasks.
- **CDN:** static assets and generated files.

SQLite can remain as a local-development option, but production behavior should be tested against PostgreSQL.

---

# 4. Bulletproof Session Handling Design

## 4.1 Replace broad statuses with a strict state machine

Use these canonical states:

| State | Meaning | Allowed next states |
|---|---|---|
| `CREATED` | Session record exists but host has not entered lobby. | `LOBBY`, `CANCELLED` |
| `LOBBY` | Players may join; quiz has not started. | `STARTING`, `CANCELLED` |
| `STARTING` | Start command accepted; initial snapshot and first round are being prepared. | `QUESTION_COUNTDOWN`, `PAUSED`, `CANCELLED` |
| `QUESTION_COUNTDOWN` | Ready/Set/Go countdown; answers closed. | `QUESTION_OPEN`, `PAUSED` |
| `QUESTION_OPEN` | Players may answer. | `QUESTION_LOCKED`, `PAUSED` |
| `QUESTION_LOCKED` | Answers closed; final calculations in progress. | `ANSWER_REVEAL`, `PAUSED` |
| `ANSWER_REVEAL` | Correct answer and explanation displayed. | `LEADERBOARD`, `NEXT_ROUND_READY`, `FINISHED` |
| `LEADERBOARD` | Round leaderboard displayed. | `NEXT_ROUND_READY`, `FINISHED`, `PAUSED` |
| `NEXT_ROUND_READY` | Waiting for host to start the next round. | `QUESTION_COUNTDOWN`, `FINISHED`, `PAUSED` |
| `PAUSED` | Session intentionally paused or automatically paused after critical host loss. | previous recoverable state, `CANCELLED` |
| `FINISHING` | Final analytics and final score commit in progress. | `FINISHED` |
| `FINISHED` | Immutable completed session. | none |
| `CANCELLED` | Session closed without normal completion. | none |

Every state transition must be validated. A host cannot jump from `LOBBY` directly to `QUESTION_OPEN`, and a player cannot submit during `QUESTION_COUNTDOWN` or `QUESTION_LOCKED`.

## 4.2 Add state versioning

Add these fields to `GameSession`:

```text
state                 ENUM
stateVersion          BIGINT NOT NULL DEFAULT 0
activeRoundId         UUID NULL
currentQuestionIndex  INTEGER
stateEnteredAt        TIMESTAMP
questionOpensAt       TIMESTAMP NULL
questionClosesAt      TIMESTAMP NULL
hostLeaseOwner        STRING NULL
hostLeaseExpiresAt    TIMESTAMP NULL
lastEventSequence     BIGINT NOT NULL DEFAULT 0
recoverySchemaVersion INTEGER NOT NULL DEFAULT 1
lastErrorCode         STRING NULL
```

Rules:

- Increment `stateVersion` in the same database transaction as every successful transition.
- Include `stateVersion`, `sessionId`, `roundId`, `eventId`, and `serverTime` in every critical socket event.
- Client applies an event only when its version is newer than the local version.
- If the client receives version 15 while it has version 12, it must call the recovery endpoint rather than guessing what versions 13 and 14 contained.

## 4.3 Use a common event envelope

Every critical event should use one schema:

```json
{
  "eventId": "uuid",
  "eventType": "SESSION_STATE_CHANGED",
  "schemaVersion": 1,
  "sessionId": "uuid",
  "pin": "123456",
  "stateVersion": 42,
  "roundId": "uuid",
  "serverTime": "2026-08-02T11:20:30.000Z",
  "correlationId": "uuid",
  "payload": {}
}
```

Validate all incoming and outgoing payloads using Joi, Zod, JSON Schema, or an equivalent shared schema package.

## 4.4 Make every command idempotent

Critical commands must contain a client-generated `commandId`:

```json
{
  "commandId": "uuid",
  "sessionId": "uuid",
  "expectedStateVersion": 41,
  "type": "START_NEXT_QUESTION",
  "payload": {}
}
```

Create an `IdempotencyRecord` table:

| Field | Purpose |
|---|---|
| `commandId` | Unique command identifier. |
| `actorId` | Host/player identity. |
| `sessionId` | Session scope. |
| `commandType` | Start, answer, finish, etc. |
| `requestHash` | Detect same ID used with different data. |
| `resultCode` | Accepted, duplicate, rejected, conflict. |
| `resultPayload` | Safe replay response. |
| `createdAt` / `expiresAt` | Retention control. |

When the same command is retried, return the original result. Never execute it twice.

## 4.5 Use acknowledgements and bounded retries

For commands such as join, start, submit answer, end question, pause, resume, and finish:

- Client sends command with acknowledgement callback or `emitWithAck`.
- Use a timeout, for example 5-10 seconds depending on the action.
- Retry a small number of times with the **same command ID**.
- Show a clear recoverable UI state: “Reconnecting,” “Confirming answer,” or “Restoring session.”
- After retry exhaustion, call the REST recovery endpoint.
- Never keep a permanent spinner without an error code and retry action.

## 4.6 Fix the “stuck on starting session” problem

The start flow should be redesigned as follows:

1. Host sends `START_SESSION` with `commandId` and `expectedStateVersion`.
2. Server transaction:
   - Locks the session row.
   - Verifies ownership and `LOBBY` state.
   - Creates the first `Round` record.
   - Sets state to `STARTING` and increments version.
   - Writes an outbox event.
   - Commits.
3. Server acknowledges immediately with accepted state/version.
4. A short server-side transition task prepares the first question and changes state to `QUESTION_COUNTDOWN`.
5. If preparation exceeds a defined threshold, a watchdog either retries safely or moves the session to `PAUSED` with `lastErrorCode`.
6. Host and player clients use a **start watchdog**:
   - If `STARTING` lasts more than 8 seconds, call `/api/sessions/:id/recovery`.
   - If state is still `STARTING`, display a retry/resume control and diagnostic code.
   - Never redirect based only on a socket event that may have been missed.
7. A server watchdog scans sessions in transient states (`STARTING`, `QUESTION_LOCKED`, `FINISHING`) past their deadlines and safely completes or pauses them.

This converts an endless spinner into a controlled, observable state.

## 4.7 Add a canonical recovery endpoint

Create:

```http
GET /api/sessions/:sessionId/recovery
Authorization: host/player session credential
```

Response:

```json
{
  "schemaVersion": 1,
  "sessionId": "uuid",
  "state": "QUESTION_OPEN",
  "stateVersion": 42,
  "serverTime": "...",
  "role": "player",
  "participant": {
    "id": "uuid",
    "score": 3200,
    "streak": 3,
    "hasAnsweredCurrentRound": true
  },
  "round": {
    "roundId": "uuid",
    "questionIndex": 4,
    "questionText": "...",
    "options": ["..."],
    "opensAt": "...",
    "closesAt": "..."
  },
  "allowedActions": [],
  "lastEventSequence": 310
}
```

The recovery response must be role-specific. Never send correct answers to players before reveal.

## 4.8 Add session event ledger and snapshots

Create a `SessionEvent` table:

```text
id, sessionId, sequence, eventType, stateVersion, roundId,
actorType, actorId, payloadJson, correlationId, createdAt
```

Create a `SessionSnapshot` table or periodically store snapshot JSON on the session:

```text
sessionId, stateVersion, snapshotJson, createdAt
```

Benefits:

- Diagnose exactly why a session became stuck.
- Replay or rebuild state if necessary.
- Produce audit trails for institutions.
- Support missed-event delivery.
- Compare expected and actual transition sequences in tests.

Do not retain sensitive tokens or unnecessary personal data in event payloads.

## 4.9 Guarantee answer submission effectively once

Create a unique database constraint:

```text
UNIQUE(sessionId, roundId, playerId)
```

Answer flow:

1. Validate token, session, player, round, and state.
2. Validate answer shape and size.
3. Begin transaction.
4. Lock or safely read the session/round.
5. Insert `PlayerAnswer` using the unique constraint.
6. Calculate points using server timestamps.
7. Update score, streak, and XP ledger.
8. Write outbox events.
9. Commit.
10. Return acknowledgement.

If the insert conflicts, fetch and return the already-recorded answer result. This makes retries safe.

Do not rely on `lastAnswerIndex` alone because it can be overwritten when the next question begins and does not create a strong round-specific uniqueness rule.

## 4.10 Use server deadlines, not long-running timers

Store timestamps (`opensAt`, `closesAt`) rather than relying on an in-memory timeout as the source of truth.

- Clients calculate display time from server time offset.
- Server validates against `closesAt`.
- A scheduled checker closes overdue rounds.
- If a process restarts, deadlines remain available in PostgreSQL.
- Allow a small configurable network grace only if desired; record it explicitly.

## 4.11 Host connection ownership and takeover

A host may open multiple tabs or reconnect rapidly. Add a host lease:

- Only one socket is the active controller.
- A new valid host connection may request takeover.
- Old host socket becomes read-only or disconnected.
- Lease renews periodically.
- If lease expires, players see “Host reconnecting” while the game state remains safe.
- Optional co-host roles can be added later with explicit permissions.

## 4.12 Multi-server reliability

For horizontal scaling:

- Use sticky sessions at the load balancer.
- Prefer the Socket.IO Redis Streams adapter when connection-state recovery across nodes is required.
- Protect Redis using private networking, ACLs, authentication, and TLS.
- Keep PostgreSQL as source of truth; Redis is not the only permanent game record.
- Use distributed leases carefully and always include expiry.

## 4.13 Socket security controls

Apply all of the following:

- WSS/HTTPS only in production.
- Explicit origin allowlist; never wildcard with credentials.
- Authenticate during handshake and authorize every event.
- Validate membership and role for each session action.
- Limit payload size.
- Per-IP and per-account connection limits.
- Per-event rate limits, especially joins, reactions, answer attempts, and PIN guessing.
- PIN attempt throttling and temporary blocks.
- Sanitize nicknames, quiz text, and reactions before rendering.
- Log security events without logging tokens or full sensitive payloads.
- Rotate and expire session tokens.
- Revoke sessions after logout, password change, account disablement, or suspicious activity.

## 4.14 Session reliability acceptance criteria

A session engine is ready only when all these tests pass:

- Host double-clicks Start 20 times; only one round starts.
- Player submits the same answer 20 times; one answer and one score update exist.
- Player loses network before submit acknowledgement; retry returns the recorded result.
- Player refreshes during countdown, open question, reveal, leaderboard, and finish; correct screen is restored.
- Host refreshes during every state; control returns without duplicating a transition.
- Backend restarts during question open; clients reconnect and timer remains correct.
- Redis disconnects temporarily; no permanent session corruption occurs.
- Two backend nodes receive related events; ordering/version checks prevent stale updates.
- Old frontend receives an unsupported recovery schema; it shows an upgrade/error screen rather than corrupting state.
- A transient state exceeds its deadline; watchdog pauses or completes it automatically.
- No player remains on an infinite “starting session” screen.

---

# 5. Preventing New Changes from Breaking Existing Functionality

## 5.1 Establish a “golden flow” test suite

The golden flow is the minimum user journey that must always work:

1. Host login.
2. Create or select quiz.
3. Start session.
4. Two guest players join, one by PIN and one by QR URL.
5. Host starts question.
6. One player answers correctly, one incorrectly.
7. Results and leaderboard display.
8. One player disconnects and reconnects.
9. Host completes game.
10. Report appears and exports successfully.

Run this automatically on every pull request.

## 5.2 Test pyramid

### Unit tests

Test pure logic without network or database:

- Scoring formulas.
- Streak rules.
- state-machine transition table.
- timer calculations.
- question validation.
- deterministic question extractors.
- quality scoring.
- plan and permission rules.

### Integration tests

Use a real test PostgreSQL database:

- start session transaction.
- answer uniqueness.
- concurrent answer writes.
- host authorization.
- state-version conflicts.
- outbox creation.
- report job creation.
- recovery snapshot correctness.

### Socket contract tests

Start a real Socket.IO server and clients:

- acknowledgements.
- retry with same command ID.
- disconnect/reconnect.
- stale event rejection.
- missed event recovery.
- rate limits and invalid payloads.

### End-to-end browser tests

Use Playwright across Chromium, Firefox, and WebKit for critical flows. Include mobile viewport projects.

### Load and chaos tests

Use a load tool capable of WebSocket scenarios:

- 50, 100, 500, and target concurrent players per session.
- many simultaneous sessions.
- join spikes.
- answer spikes at the final second.
- server restart.
- Redis delay/disconnect.
- database failover or connection-pool exhaustion.
- network delay, packet loss, and reconnect storms.

## 5.3 Required CI pipeline

Every pull request should run:

```text
1. Install with locked dependencies
2. Lint and format check
3. Type check (recommended TypeScript migration)
4. Unit tests
5. Integration tests with PostgreSQL and Redis containers
6. Socket tests
7. Frontend component tests
8. Golden-flow Playwright tests
9. Build frontend and backend
10. Dependency/security scan
11. Database migration validation
12. Preview deployment smoke test
```

No merge when a required gate fails.

## 5.4 Coverage rules

Do not chase 100% line coverage. Set meaningful thresholds:

- Session state machine and scoring: 95%+ branch coverage.
- Authentication and authorization: 90%+ branch coverage.
- Document-to-question pipeline: 85%+ branch coverage plus corpus quality tests.
- General UI: lower thresholds are acceptable, but all critical flows require end-to-end coverage.

## 5.5 Feature flags

Every risky feature should be behind a flag:

- `new_session_engine`
- `document_question_generator`
- `adaptive_learning`
- `redis_streams_adapter`
- `new_report_worker`
- `institution_tenancy`

Flags may be enabled for developers, internal accounts, 5% of users, selected institutions, and then everyone.

## 5.6 Safe database migrations

Use the expand-and-contract pattern:

1. Add new columns/tables without removing old ones.
2. Deploy code that writes both old and new formats where necessary.
3. Backfill data in a job.
4. Validate counts and checksums.
5. Switch reads to the new format.
6. Monitor.
7. Remove old fields in a later release.

Never combine destructive schema removal and dependent code changes in one emergency release.

## 5.7 Version API and socket contracts

- Add `schemaVersion` to recovery payloads and critical events.
- Maintain compatibility for at least one previous frontend deployment during rolling releases.
- Use consumer-driven contract tests for frontend/backend payloads.
- Reject unknown critical commands safely.

## 5.8 Release process

Recommended environments:

- Local.
- Automated test.
- Staging using production-like PostgreSQL/Redis.
- Production canary.
- Production.

For each release:

- Database backup or verified point-in-time recovery.
- Migration dry run.
- Automated smoke test.
- Canary traffic or selected tenant.
- Monitor session-start success, join success, reconnect success, errors, and latency.
- One-click rollback or flag disablement.

## 5.9 Definition of Done for every change

A task is not complete unless:

- Acceptance criteria are written.
- Unit/integration/E2E tests are added or updated.
- Authorization is reviewed.
- Loading, empty, error, retry, and offline states are handled.
- Mobile and desktop are checked.
- Accessibility is checked.
- Telemetry and error codes are added.
- Database migration is backward compatible.
- Documentation is updated.
- Golden flow passes.

---

# 6. Deterministic Document-to-Question Generator (No Paid AI Required)

## 6.1 Feasibility statement

A non-generative engine can produce useful questions from course or chapter documents at near-zero marginal inference cost. It can be robust for structured factual content, but it cannot reliably understand every ambiguous paragraph like a strong language model. Therefore:

- Generate only when the engine has evidence and a sufficient confidence score.
- Prefer extractive questions whose answer is explicitly present in the source.
- Show source sentence/page for reviewer verification.
- Route weak candidates to manual review rather than inventing facts.
- Keep optional AI as a premium fallback, not as a dependency.

## 6.2 Supported input

Phase 1:

- PDF with selectable text.
- DOCX.
- TXT and Markdown.
- Pasted text.

Phase 2:

- PPTX speaker notes and slide text.
- Scanned PDFs through OCR.
- Images with OCR.
- Web pages with safe URL fetching.

Recommended limits for the first release:

- 1-20 pages per synchronous preview.
- Larger documents submitted as background jobs.
- Maximum file size and page count configurable by plan.

## 6.3 Pipeline overview

```text
Upload
  -> Malware/type/size validation
  -> Text extraction with page references
  -> Header/footer and noise removal
  -> Section and sentence segmentation
  -> Candidate fact extraction
  -> Keyword and answer-span scoring
  -> Question template selection
  -> Distractor generation
  -> Answer verification against source
  -> Duplicate and ambiguity filtering
  -> Difficulty estimation
  -> Quality/confidence score
  -> Review queue
  -> Approved question bank
```

## 6.4 Stage 1 - Document ingestion

Create `DocumentImport` and `DocumentChunk` records.

`DocumentImport` fields:

```text
id, organizationId, uploaderId, fileName, fileType, objectStorageKey,
status, pageCount, language, checksum, parserVersion, errorCode,
createdAt, completedAt
```

`DocumentChunk` fields:

```text
id, documentId, pageStart, pageEnd, sectionPath, rawText,
cleanText, contentHash, tokenCount
```

Security requirements:

- Verify MIME type and extension.
- Scan uploads.
- Store outside the web root.
- Generate random object keys.
- Never execute macros or embedded content.
- Set file, page, text, and processing limits.
- Delete or retain source files according to institution policy.

## 6.5 Stage 2 - Cleaning and segmentation

Rules should remove:

- repeated headers and footers.
- page numbers.
- table-of-content lines.
- copyright boilerplate if repeated.
- broken line-wrap hyphenation.
- excessive whitespace.
- references/bibliography when not requested.

Preserve:

- headings and hierarchy.
- bullet/list boundaries.
- page number.
- table row relationships where possible.
- formulas and symbols.

Split into sentences, but keep each sentence linked to its section and page.

## 6.6 Stage 3 - Candidate concept extraction

Use a combination of deterministic scores:

### Keyword score

- TF-IDF within the document.
- RAKE-style keyphrase scoring.
- heading frequency and emphasis.
- term occurrence across sections.
- glossary/definition markers.

### Pattern score

High-value sentence patterns:

- `X is Y`
- `X means Y`
- `X refers to Y`
- `X is defined as Y`
- `The purpose of X is Y`
- `X consists of A, B, and C`
- `X occurs because Y`
- `X results in Y`
- `X was established in YEAR`
- `X has N components`
- `First..., then..., finally...`
- `Unlike X, Y...`
- acronym patterns such as `Full Form (ABC)`
- numerical formulas and worked examples

### Sentence quality score

Reject or down-rank sentences that:

- depend heavily on pronouns without local context.
- contain unresolved references such as “this,” “it,” or “the above.”
- are extremely short or long.
- contain multiple unrelated facts.
- include uncertain language (“may,” “possibly”) unless the question preserves it.
- contain citations but no self-contained claim.

## 6.7 Question types generated by rules

### A. Definition multiple choice

Source: “Phishing is a social engineering attack used to trick users into revealing sensitive information.”

Question: “What is phishing?”

Correct answer: extracted definition.

Distractors: definitions of other concepts from the same document/topic bank.

### B. Fill in the blank

Source: “The CPU is known as the brain of the computer.”

Question: “The _____ is known as the brain of the computer.”

Correct answer: CPU.

### C. Fact multiple choice

Source: “The process has four stages.”

Question: “How many stages does the process have?”

Correct answer: four.

Distractors: nearby plausible numbers, excluding numbers that make another source statement true.

### D. Date/year question

Source: “The organization was established in 1945.”

Question: “In which year was the organization established?”

### E. Acronym/full-form question

Source: “Central Processing Unit (CPU) executes instructions.”

Questions:

- “What does CPU stand for?”
- “Which acronym represents Central Processing Unit?”

### F. List membership

Source: “The security principles are confidentiality, integrity, and availability.”

Question: “Which of the following is one of the listed security principles?”

Or: “Which option is NOT part of the listed principles?” only when safe distractors exist.

### G. Sequence/order

Source has explicit numbered steps.

Question: “Which step comes immediately after X?” or an ordering interaction.

### H. Cause and effect

Source: “Weak passwords increase the likelihood of account compromise.”

Question: “According to the chapter, what can weak passwords increase?”

### I. Comparison

Source: “RAM is volatile, whereas ROM is non-volatile.”

Question: “How does RAM differ from ROM?”

### J. Controlled true/false

True statement: use the exact source claim.

False statement: mutate **one** controlled element:

- swap two named entities.
- change a number within a safe range.
- replace “increases” with “decreases.”
- replace one list member with an unrelated concept.

Every false statement must be checked to ensure it does not appear as true elsewhere in the document.

### K. Table-derived question

For simple tables:

- value lookup.
- row/column matching.
- highest/lowest comparison.
- category membership.

Do not generate from complex merged tables until parsing accuracy is proven.

## 6.8 Distractor generation without generative AI

Distractors determine question quality. Use this hierarchy:

1. **Same semantic type from the same document:** other dates, people, processes, definitions, units, or terms.
2. **Same taxonomy from curated bank:** other planets, protocols, programming languages, formulas, capitals, etc.
3. **Morphological variants:** acronym/full form mismatches.
4. **Numerical neighbors:** only for numerical questions and after validation.
5. **Controlled swaps:** entities appearing in parallel sentences.

Distractor rules:

- Same grammatical form and similar length.
- No duplicate meaning.
- No obviously absurd answer unless question is beginner-level.
- No “all of the above” in automatically generated questions.
- Do not create more than one arguably correct option.
- Verify each distractor is not stated as the answer in the relevant source context.

## 6.9 Quality scoring

Each question receives 0-100:

| Component | Weight |
|---|---:|
| Source answer is explicit and unique | 25 |
| Question is self-contained | 15 |
| Distractors are same type and plausible | 15 |
| No second correct answer detected | 15 |
| Important concept score | 10 |
| Clear grammar and length | 10 |
| Source/page traceability | 5 |
| Difficulty target match | 5 |

Suggested handling:

- 85-100: auto-approve only for trusted templates and low-risk content.
- 70-84: ready for quick review.
- 50-69: requires editing.
- Below 50: discard.

For the first production version, require host review for all generated questions. Auto-approval can be enabled later by organization policy.

## 6.10 Difficulty calculation

Use interpretable features:

- answer frequency in document.
- sentence complexity.
- number of concepts in question.
- distractor similarity.
- whether answer is in heading, body, table, or inference.
- historical response accuracy after the question is used.

Initial difficulty is algorithmic; later difficulty should be recalibrated using real response data.

## 6.11 Optional local NLP without paid API calls

The system can optionally use local libraries/models for:

- sentence segmentation.
- part-of-speech tagging.
- named entity recognition.
- noun phrase extraction.
- similarity for duplicate detection.

This has server compute cost but no per-question API fee. Keep a pure-rule fallback so imports still work when local NLP workers are unavailable.

## 6.12 Pseudocode

```javascript
async function generateQuestions(documentId, settings) {
  const chunks = await loadCleanChunks(documentId);
  const candidates = [];

  for (const chunk of chunks) {
    const sentences = segmentSentences(chunk.cleanText);
    const keywords = scoreKeywords(sentences, chunk.sectionPath);

    for (const sentence of sentences) {
      const patterns = detectFactPatterns(sentence);
      for (const pattern of patterns) {
        const candidate = buildQuestionFromTemplate(pattern, sentence, chunk);
        if (!candidate) continue;

        candidate.distractors = buildDistractors(candidate, chunks, settings);
        candidate.validation = validateAgainstSource(candidate, chunks);
        candidate.qualityScore = scoreQuality(candidate);

        if (candidate.qualityScore >= settings.minimumScore) {
          candidates.push(candidate);
        }
      }
    }
  }

  return deduplicateAndBalance(candidates, settings);
}
```

## 6.13 Review interface

The author should see:

- generated question.
- correct answer and distractors.
- question type and difficulty.
- confidence score.
- source page and highlighted source sentence.
- warning reasons.
- edit, approve, reject, regenerate distractors, and bulk approve controls.

The reviewer should be able to set:

- number of questions.
- target difficulty mix.
- question types.
- sections to include/exclude.
- language.
- timer recommendations.

## 6.14 API proposal

```http
POST /api/documents
POST /api/documents/:id/generate-questions
GET  /api/generation-jobs/:jobId
GET  /api/documents/:id/question-candidates
PATCH /api/question-candidates/:id
POST /api/question-candidates/bulk-approve
POST /api/question-candidates/publish-to-quiz
```

Long jobs should return `202 Accepted` with a job ID.

## 6.15 Test corpus and acceptance

Create a fixed evaluation corpus across:

- school science.
- mathematics theory.
- history.
- computer science.
- cybersecurity awareness.
- business studies.
- a table-heavy chapter.
- a poor-quality PDF.
- a document with headers/footers.
- a document with ambiguous pronouns.

Measure:

- extraction success.
- factual correctness.
- unique correct answer rate.
- usable-without-edit rate.
- average reviewer editing time.
- duplicate rate.
- generation cost and duration.

Initial target:

- 95% of published questions must have an answer directly supported by the cited source span.
- Fewer than 2% may contain more than one defensible correct option.
- At least 60% of high-confidence factual candidates should be usable with no or minor edits.

---

# 7. Question Bank Expansion Plan

## 7.1 Use a structured taxonomy

Do not store questions only under a free-text topic. Use:

```text
Country / Board / Institution
  -> Grade / Year / Exam
    -> Subject
      -> Unit
        -> Chapter
          -> Topic
            -> Learning outcome
```

Also tag:

- difficulty.
- question type.
- cognitive level.
- language.
- estimated time.
- source/licence.
- version.
- review status.
- historical accuracy rate.

## 7.2 Priority content categories

### College aptitude and placement

- quantitative aptitude.
- logical reasoning.
- verbal ability.
- data interpretation.
- analytical reasoning.
- coding aptitude.
- interview preparation.
- company/industry-specific practice sets where legally appropriate.

### Mathematics

- arithmetic.
- algebra.
- geometry.
- trigonometry.
- probability.
- statistics.
- calculus.
- discrete mathematics.
- engineering mathematics.

### General knowledge

- history.
- geography.
- civics.
- economics.
- science.
- technology.
- arts and culture.
- sports.
- current affairs as a separately dated and expiring content type.

### Computer science

- programming fundamentals.
- data structures.
- algorithms.
- databases.
- operating systems.
- networking.
- software engineering.
- cloud and DevOps.
- cybersecurity.
- AI/ML fundamentals.

### Academic subjects

- physics.
- chemistry.
- biology.
- commerce.
- accounting.
- business studies.
- English and communication.

### Employability and professional skills

- workplace communication.
- digital literacy.
- compliance and ethics.
- cybersecurity awareness.
- financial literacy.
- project management.

## 7.3 Parameterized question generators

For mathematics and aptitude, do not manually write every question. Build verified templates:

```text
Template: Simple interest
Inputs: principal range, rate range, time range
Generator: computes exact answer and distractors from common mistakes
Difficulty: based on decimals, units, number of steps
Validation: independent recomputation
```

Other template families:

- percentages and profit/loss.
- ratio and proportion.
- time and work.
- time, speed, distance.
- averages.
- mixtures.
- probability.
- permutations/combinations.
- number series.
- syllogisms.
- seating arrangements.
- data tables and charts.
- equations and identities.

Each generated item must include:

- deterministic seed.
- formula/template version.
- correct answer proof.
- common-error distractor explanation.
- reproducible test.

## 7.4 Editorial workflow

Question lifecycle:

```text
DRAFT -> AUTOMATED_CHECK -> REVIEW_1 -> REVIEW_2 -> PUBLISHED ->
MONITORED -> REVISED / RETIRED
```

Checks:

- spelling and grammar.
- answer uniqueness.
- source/licence.
- bias/sensitivity.
- age appropriateness.
- duplicate similarity.
- rendering of formulas/images.
- difficulty calibration.

## 7.5 Versioning

Never silently edit a question already used in reports. Create a new version and keep the old version linked to historical answers.

## 7.6 Current affairs handling

Current affairs questions need:

- fact date.
- source date.
- valid-from and expires-at.
- editorial verification.
- automatic retirement or review.

Do not mix time-sensitive GK with permanent GK without expiry metadata.

---

# 8. High-Value New Features

## 8.1 P0/P1 features after stabilization

### Session diagnostics dashboard

For each live session show:

- state and state version.
- host connection.
- connected/reconnecting players.
- event lag.
- database/Redis health.
- transient-state age.
- recent error codes.
- safe pause/resume/terminate controls.

### Self-paced assignments

Hosts assign a quiz with:

- start/end date.
- attempt limit.
- shuffle options/questions.
- immediate or delayed results.
- pass score.
- completion reminders.

### Practice mode

- no leaderboard pressure.
- explanation after every answer.
- retry incorrect questions.
- mastery progress.
- recommended next practice.

### Additional interaction types

- true/false.
- multiple correct.
- numerical answer.
- short answer with normalized matching.
- matching pairs.
- ordering.
- polls.
- word clouds.
- hotspot/image questions.
- case-study question sets.

### Question explanations and learning cards

After an answer, display a concise explanation, source, and “learn more” card. This makes the product more educational and not only competitive.

### Co-host and moderator

Roles:

- owner.
- co-host.
- moderator.
- observer.

Permission matrix must be explicit.

## 8.2 Learning platform features

### Courses and learning paths

A course contains modules, learning content, quizzes, assignments, and certificates.

### Mastery and spaced repetition

- Track mastery by learning outcome.
- Resurface weak concepts.
- Use spaced intervals.
- Separate practice XP from competitive score.

### Adaptive difficulty

Use performance data to choose the next item from a calibrated bank. Start with clear rules before adding machine learning.

### Flashcards

Generate from approved question/answer pairs or document definitions.

### Certificates

- template builder.
- verification code/URL.
- organization branding.
- expiry for compliance courses.

### Learning analytics

- mastery by topic.
- misconception analysis.
- time-on-question.
- participation and completion.
- cohort comparisons.
- intervention recommendations.

## 8.3 Engagement features

- leagues and seasonal tournaments.
- class/team competitions.
- badges based on learning behavior, not only speed.
- daily/weekly practice streaks with healthy limits.
- challenge a friend.
- collaborative team questions.
- class goals.
- achievement showcase.
- creator profiles and content collections.

Avoid making speed the dominant success metric for every mode. Accuracy, improvement, teamwork, and completion should also be rewarded.

## 8.4 Institution and enterprise features

### Multi-tenancy

Add `Organization`, `Workspace`, `Membership`, `Role`, and `Class/Cohort` models. Every query must enforce organization scope.

### User provisioning

- CSV import.
- invitation links.
- domain-based joining.
- SSO/SAML/OIDC for enterprise plans.
- SCIM later.

### Branding and white-label

- logo.
- colors.
- custom domain.
- email templates.
- report and certificate branding.

### Governance

- audit log.
- content approval.
- retention settings.
- privacy controls.
- data export/deletion.
- role-based access.

### Integrations

Prioritize based on target customers:

- Google Classroom.
- Microsoft Teams/Education.
- LMS integration through LTI where relevant.
- SCORM export/import where appropriate.
- webhooks and REST API.
- CSV/Excel imports.

## 8.5 Accessibility and inclusive design

- WCAG-oriented keyboard navigation.
- visible focus states.
- screen reader labels.
- color is never the only answer indicator.
- high contrast mode.
- reduced motion option.
- captions/transcripts for media.
- adjustable text size.
- extended-time accommodation per player.
- dyslexia-friendly option.
- non-speed scoring mode.

## 8.6 Low-bandwidth and offline resilience

- PWA shell.
- asset preloading.
- compressed question media.
- low-bandwidth mode disabling heavy animation/audio.
- reconnect-safe answer confirmation.
- self-paced offline cache with sync conflict rules.

Live multiplayer cannot be fully offline, but it can degrade gracefully.

## 8.7 Anti-cheat and assessment integrity

For formal assessment mode:

- randomized question/order variants.
- question pools.
- time windows.
- one active attempt policy.
- resume rules.
- copy/paste controls as a deterrent only, not a guarantee.
- tab visibility logging with transparent privacy notice.
- anomaly flags, not automatic accusations.
- answer pattern analysis.
- secure exam links and access codes.

Keep high-surveillance proctoring separate from normal learning. It increases privacy, support, and compliance burden.

## 8.8 Content marketplace

Creators/institutions may publish:

- free packs.
- paid packs.
- verified packs.
- institution-private libraries.

Requirements:

- licensing declaration.
- moderation.
- plagiarism/duplicate checks.
- ratings and usage analytics.
- revenue share.
- takedown workflow.

---

# 9. Analytics and Observability

## 9.1 Product KPIs

Track:

- session-start success rate.
- median time from Start click to countdown.
- join success rate.
- reconnect success rate.
- answer acknowledgement latency.
- sessions completed without error.
- report generation success/time.
- question creation-to-publish rate.
- generated question approval rate.
- weekly active hosts and players.
- quizzes hosted per active host.
- assignment completion.
- free-to-paid conversion.
- institution retention.

## 9.2 Reliability targets

Initial targets:

- 99.9% successful accepted session transitions.
- 99.5%+ successful reconnection within recovery window.
- 99.9% answer persistence for acknowledged answers.
- no duplicate score awards.
- p95 answer acknowledgement below 500 ms under target load.
- p95 session recovery below 2 seconds.
- report jobs retry automatically and never block live gameplay.

## 9.3 Structured logging

Every log entry should contain applicable fields:

```text
correlationId, commandId, eventId, sessionId, stateVersion,
roundId, actorId, role, socketId, nodeId, latencyMs, errorCode
```

Do not log access tokens, full JWTs, passwords, or entire uploaded documents.

## 9.4 Metrics and alerts

Alert on:

- spike in `STARTING` states older than threshold.
- join failures.
- reconnect failures.
- command conflicts.
- database pool saturation.
- Redis disconnects.
- worker backlog.
- report failures.
- generation-job failures.
- 5xx rate and latency.

## 9.5 Error codes

Use stable, searchable codes:

- `SESSION_STATE_CONFLICT`
- `SESSION_START_TIMEOUT`
- `HOST_LEASE_LOST`
- `PLAYER_ALREADY_ANSWERED`
- `ROUND_CLOSED`
- `RECOVERY_VERSION_UNSUPPORTED`
- `DOCUMENT_PARSE_FAILED`
- `QUESTION_AMBIGUOUS`
- `REPORT_JOB_FAILED`

Show a safe short code in the UI so support can locate logs.

---

# 10. Security and Privacy Hardening

## 10.1 Authentication

- Short-lived access tokens.
- Rotating refresh tokens or server-side sessions.
- Prefer secure, HttpOnly, SameSite cookies for host web sessions where architecture permits.
- Token revocation and device/session list.
- email verification and password reset protections.
- MFA for institution admins and creators.
- Google token verification with audience and issuer checks.

## 10.2 Authorization

Implement centralized policy checks:

```text
canViewQuiz(user, quiz)
canEditQuiz(user, quiz)
canHostQuiz(user, quiz)
canControlSession(user, session)
canJoinSession(player, session)
canViewReport(user, session)
```

Never depend on hidden UI buttons as authorization.

## 10.3 Data privacy

- Data minimization for guest players.
- configurable nickname retention.
- child/student privacy controls where applicable.
- export and deletion workflows.
- document retention policy.
- encrypted backups.
- audit administrative access.
- tenant separation tests.

## 10.4 Dependency and secret management

- locked dependencies.
- automated vulnerability scanning.
- secret manager in production.
- no secrets in frontend builds or repository.
- key rotation.
- separate credentials by environment.

---

# 11. Revenue and Packaging Strategy

## 11.1 Suggested plans

### Free

- limited active players/session.
- limited quizzes and storage.
- core live question types.
- public/basic question library.
- basic reports.
- small monthly deterministic document-generation allowance.

### Pro Educator / Creator

- larger sessions.
- self-paced assignments.
- complete reports.
- document import and high limits.
- question bank tools.
- advanced interaction types.
- certificates.
- branding options.

### Institution

- organization workspace.
- admin dashboard.
- classes/cohorts.
- shared content library.
- roles and approvals.
- SSO options.
- central analytics.
- data retention controls.
- priority support.

### Enterprise / White-label

- custom domain and branding.
- API/webhooks.
- dedicated capacity or region.
- advanced security controls.
- SLA.
- onboarding and migration.
- custom integrations.

### Marketplace revenue

- commission on paid content.
- verified creator program.
- institutional content licensing.

## 11.2 Cost controls

- Rules-first question generation.
- Optional AI credits, never unlimited unmetered use.
- cache identical document checksum results.
- background worker concurrency limits.
- object-storage lifecycle rules.
- pre-generate reusable aptitude variants.
- plan-based report retention.
- tenant quotas and abuse controls.

## 11.3 Revenue-enabling differentiators

Strong positioning can be built around:

- reliable live sessions.
- document-to-quiz generation with visible source evidence.
- large college aptitude and academic bank.
- live + self-paced + course modes in one product.
- institution analytics and white-label.
- lower AI dependency and predictable pricing.

---

# 12. Phased Implementation Roadmap

Do not start all streams together. Complete each exit gate before advancing.

## Phase 0 - Baseline Freeze and Audit

**Objective:** Know exactly what works before refactoring.

Tasks:

- Tag current production version.
- Export environment/config inventory without secrets.
- Create current database schema diagram.
- Record all REST and socket contracts.
- Add the golden-flow manual checklist.
- Capture current performance and failure metrics.
- Reproduce the “starting session” issue and assign an error trace/correlation ID.
- Create a staging environment using PostgreSQL and Redis.

Exit gate:

- Current golden flow is reproducible.
- Known bugs are documented.
- Rollback version exists.

## Phase 1 - Test Harness and Module Extraction

**Objective:** Make existing behavior testable without changing user experience.

Tasks:

- Add unit test framework and coverage.
- Add PostgreSQL integration test environment.
- Add Socket.IO integration tests.
- Add Playwright golden flow.
- Extract scoring service.
- Extract authorization service.
- Extract session query/recovery service.
- Add schema validation to socket payloads.

Exit gate:

- Golden flow passes automatically.
- Scoring and permissions have high branch coverage.
- No user-facing behavior regression.

## Phase 2 - Session Engine V2

**Objective:** Eliminate stuck and duplicate state transitions.

Tasks:

- Add expanded state enum and `stateVersion`.
- Add `Round`, `SessionEvent`, `IdempotencyRecord`, and outbox tables.
- Implement state transition service.
- Implement command IDs and acknowledgements.
- Implement canonical recovery endpoint.
- Implement host lease.
- Implement transient-state watchdog.
- Add client reducer/state machine.
- Add feature flag and migrate selected internal sessions first.

Exit gate:

- All session reliability acceptance tests pass.
- No infinite starting screen.
- Duplicate commands are harmless.

## Phase 3 - Production Infrastructure and Background Jobs

**Objective:** Separate live play from heavy work and prepare for revenue.

Tasks:

- PostgreSQL-only production.
- Redis Streams Socket.IO adapter where required.
- Sticky sessions and multi-node test.
- Durable queue and workers.
- Move reports to worker.
- Object storage for uploads/reports.
- backups and restore drill.
- structured logs, metrics, dashboards, and alerts.

Exit gate:

- Backend restart and worker failure tests pass.
- Reports do not affect live latency.
- Restore procedure is proven.

## Phase 4 - Deterministic Document Question Generator MVP

**Objective:** Generate reviewable questions from 1-20 page text-based documents.

Tasks:

- Secure upload and storage.
- PDF/DOCX/TXT extraction.
- cleaning and page mapping.
- definition, fill-blank, acronym, number/date, list, and true/false templates.
- distractor engine.
- quality scoring.
- review UI with source highlight.
- background jobs and quotas.
- fixed evaluation corpus.

Exit gate:

- Published question factual support target is achieved.
- No paid AI is required for normal operation.
- Low-confidence output is never silently published.

## Phase 5 - Question Bank and Aptitude Generators

**Objective:** Build scalable content inventory.

Tasks:

- taxonomy and metadata.
- review/version lifecycle.
- math and aptitude template engine.
- deterministic seeds and proof fields.
- import tools.
- duplicate detection.
- initial curated packs.

Exit gate:

- A question can be traced to source/template and version.
- Generated math answers are independently verified.
- Bank supports search and balanced quiz assembly.

## Phase 6 - Self-Paced Learning and New Interactions

**Objective:** Increase retention beyond live events.

Tasks:

- assignments and practice.
- explanations.
- multiple question types.
- retry incorrect answers.
- mastery by topic.
- basic spaced repetition.
- certificates.
- accessible/non-speed modes.

Exit gate:

- Live and self-paced modes share validated question models without breaking each other.

## Phase 7 - Institution and Commercial Platform

**Objective:** Sell safely to colleges, schools, training companies, and enterprises.

Tasks:

- multi-tenancy.
- memberships and roles.
- classes/cohorts.
- organization analytics.
- branding.
- billing/subscriptions/quotas.
- SSO roadmap.
- audit logs and retention.
- onboarding and support tooling.

Exit gate:

- Tenant isolation tests pass.
- Plan enforcement is server-side.
- Billing events are idempotent.

## Phase 8 - Marketplace, Integrations, and Optional Hybrid AI

**Objective:** Expand distribution and premium value.

Tasks:

- content marketplace.
- APIs/webhooks.
- LMS/classroom integrations.
- multilingual workflows.
- optional AI refinement for low-confidence questions.
- creator revenue share.

Exit gate:

- AI is optional and metered.
- marketplace moderation and licensing workflows are live.

---

# 13. Antigravity Implementation Rules

Give Antigravity these standing rules for every task:

1. Read `PROJECT_DOCUMENTATION.md` and this blueprint before editing.
2. Do not rewrite unrelated modules.
3. Reproduce the current behavior with a test before refactoring it.
4. Make the smallest safe change.
5. Use feature flags for high-risk behavior.
6. Never modify session state directly outside `SessionCommandService`.
7. Every critical socket command must have authentication, authorization, validation, command ID, acknowledgement, timeout, retry behavior, and tests.
8. Every database change needs a migration and rollback/compatibility plan.
9. Never trust client score, time remaining, role, session ownership, or answer eligibility.
10. Do not use in-memory state as the only source of truth.
11. Background work must be retryable and idempotent.
12. Add error, loading, timeout, empty, and recovery UI states.
13. Run the full golden flow after every change.
14. Do not mark work complete when any required test fails.
15. Update documentation and migration notes.
16. State what files changed, why, tests added, and known limitations.

---

# 14. Master Prompt for Antigravity

Copy the following prompt into Antigravity when beginning the improvement program:

```text
You are improving Quizmoto/Kahoot Awareness, a revenue-intended real-time
multiplayer learning platform. Read PROJECT_DOCUMENTATION.md and
Quizmoto_Enhancement_and_Reliability_Blueprint.md completely before changing
code.

Primary rule: protect existing functionality. Do not implement multiple phases
at once. Work only on the phase and task explicitly assigned. Before changing
behavior, create or update a test that proves the current or required behavior.

Architecture requirements:
- PostgreSQL is the production source of truth.
- Session changes go only through a strict server-side state machine and
  SessionCommandService.
- Critical commands use commandId, expectedStateVersion, acknowledgement,
  bounded retry, authorization, schema validation, and idempotent persistence.
- Critical events include eventId, schemaVersion, sessionId, stateVersion,
  roundId, serverTime, and correlationId.
- Clients apply only newer state and call the recovery endpoint when versions
  are missing or recovery is uncertain.
- Answers have a unique sessionId+roundId+playerId constraint and are scored in
  the same transaction as answer persistence.
- Heavy work runs through durable background jobs and must be idempotent.
- New risky behavior is protected by a feature flag.

Quality requirements after every change:
1. Run lint/type checks.
2. Run unit tests.
3. Run PostgreSQL integration tests.
4. Run Socket.IO disconnect/reconnect and duplicate-command tests.
5. Run the Playwright golden flow on desktop and mobile viewport.
6. Build frontend and backend.
7. Report any failure; do not hide or bypass it.

For each task, first produce:
- files/modules affected;
- database/API/socket contract impact;
- tests to add;
- migration and rollback approach;
- security and authorization checks;
- acceptance criteria.

Then implement only that task. At completion, provide:
- exact changes made;
- tests added and results;
- manual checks performed;
- remaining risks;
- documentation updates.
```

## 14.1 Recommended first Antigravity task

```text
Phase 0/1 task: Build a complete automated golden-flow test for the existing
application without changing user-facing behavior. Cover host login with a test
account, quiz selection, session creation, two player joins, one question,
correct and incorrect answers, leaderboard, one player reconnect, game finish,
and report visibility. Add deterministic test data and cleanup. Document every
current failure discovered. Do not refactor the session engine until this test
can run reliably in staging.
```

## 14.2 Recommended second Antigravity task

```text
Extract the scoring logic and session transition validation from
socketHandlers.js into pure, separately tested domain modules. Preserve current
behavior. Add branch-complete tests for scoring, streaks, allowed transitions,
invalid transitions, duplicate starts, duplicate answers, and timer boundaries.
Do not change socket event names or UI behavior in this task.
```

---

# 15. Post-Change Verification Checklist

Antigravity must run this after **every** meaningful change:

## Functional

- Host can log in.
- Dashboard loads quizzes.
- Quiz create/edit/delete works.
- Session is created once.
- QR and PIN join work.
- Duplicate nickname gives a controlled message.
- Start moves every participant to the correct state.
- Timer is synchronized.
- Answer is stored once.
- Score and streak are correct.
- Results and leaderboard are correct.
- Next question works.
- Player reconnect restores exact state.
- Host reconnect restores control.
- End game works once.
- Report is generated or queued successfully.

## Failure behavior

- API timeout shows retry, not endless loading.
- socket disconnect shows reconnect status.
- stale event is ignored.
- invalid state command is rejected.
- database error does not partially award score.
- worker failure retries safely.
- unsupported schema shows controlled error.

## Security

- unauthorized host cannot control another session.
- player cannot submit for another player.
- player cannot submit after close.
- payload size and schema are enforced.
- origin restrictions work.
- PIN guessing is rate limited.
- no token appears in logs.

## Compatibility

- desktop Chrome/Firefox/Safari-equivalent.
- common mobile viewports.
- keyboard navigation.
- reduced motion.
- low-bandwidth mode where applicable.

## Delivery

- migrations applied in clean database.
- migrations applied to a copy of existing data.
- rollback/feature disablement documented.
- documentation updated.
- golden-flow test passes.

---

# 16. Suggested Database Additions

```text
Organization
Workspace
Membership
ClassCohort
Course
Module
LearningOutcome
Assignment
AssignmentAttempt
QuestionVersion
QuestionSource
QuestionTag
QuestionTemplate
GeneratedQuestionCandidate
DocumentImport
DocumentChunk
GenerationJob
Round
SessionEvent
SessionSnapshot
IdempotencyRecord
OutboxEvent
HostLease (or fields on GameSession)
XPTransaction
Subscription
UsageLedger
AuditLog
FeatureFlag
```

Do not add all tables immediately. Introduce them only in the relevant phase.

---

# 17. Prioritization Matrix

| Initiative | User value | Reliability impact | Revenue impact | Complexity | Recommended order |
|---|---:|---:|---:|---:|---:|
| Golden-flow tests | High | Very high | Medium | Medium | 1 |
| Session Engine V2 | Very high | Very high | High | High | 2 |
| PostgreSQL + worker queue | High | Very high | High | High | 3 |
| Observability dashboard | High | High | Medium | Medium | 4 |
| Deterministic document generator | Very high | Medium | Very high | High | 5 |
| Question taxonomy/bank | High | Medium | Very high | High | 6 |
| Self-paced assignments | Very high | Medium | High | Medium | 7 |
| Institution tenancy | High | High | Very high | High | 8 |
| Billing and quotas | Medium | Medium | Very high | Medium | 9 |
| Marketplace | High | Medium | High | Very high | 10 |
| Advanced AI refinement | Medium | Low | Medium | Medium | Later |

---

# 18. Final Recommendation

Do not ask Antigravity to “make the whole project best” in one prompt. That instruction encourages broad changes and regression risk. Use this blueprint phase by phase, beginning with the golden-flow test and session state engine.

The most commercially valuable combination is:

1. Extremely reliable live gameplay.
2. Rules-first document-to-question generation with visible source evidence.
3. A large, structured aptitude/academic question bank.
4. Live, self-paced, course, and institution modes.
5. Predictable plans that do not depend on unlimited AI calls.

Once stability and test automation are established, the project can grow quickly without every enhancement becoming a new risk to session creation, player recovery, or scoring.

---

# Technical References

The recommendations were informed by the supplied project documentation and the following primary/official technical sources current as of 2 August 2026:

- Socket.IO, “Connection state recovery”: https://socket.io/docs/v4/connection-state-recovery/
- Socket.IO, “Delivery guarantees”: https://socket.io/docs/v4/delivery-guarantees/
- Socket.IO, “Redis Streams adapter”: https://socket.io/docs/v4/redis-streams-adapter/
- Socket.IO, “Testing”: https://socket.io/docs/v4/testing/
- OWASP, “Session Management Cheat Sheet”: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP, “WebSocket Security Cheat Sheet”: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
- Sequelize, “Transactions”: https://sequelize.org/docs/v6/other-topics/transactions/
- PostgreSQL, “Transaction Isolation”: https://www.postgresql.org/docs/current/transaction-iso.html
- Playwright, documentation: https://playwright.dev/docs/intro
- Vitest, coverage guide: https://vitest.dev/guide/coverage
- BullMQ, idempotent jobs and retries: https://docs.bullmq.io/patterns/idempotent-jobs

