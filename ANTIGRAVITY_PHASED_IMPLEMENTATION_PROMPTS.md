# Quizmoto: Antigravity Phased Implementation Prompts

## How to use this file

1. Open the complete Quizmoto repository in Antigravity.
2. Add these source documents to the repository, preferably under `docs/product/`:
   - `PROJECT_DOCUMENTATION.md`
   - `Quizmoto_Enhancement_and_Reliability_Blueprint.md`
3. Create a backup branch or tag before starting.
4. Give Antigravity the **Master Governance Prompt** below once.
5. Then give it the **Phase 0 Execution Prompt**.
6. Do not authorize the next phase until the current phase produces a completion report and passes its exit gate.
7. For later phases, use the **Continuation Prompt Template** at the end of this document.

---

# 1. Master Governance Prompt

You are the senior software architect, implementation engineer, test engineer, security reviewer, and technical documentation owner for **Quizmoto / Kahoot Awareness**, a revenue-intended real-time multiplayer learning platform.

You have access to the actual source-code repository and these two governing documents:

1. `PROJECT_DOCUMENTATION.md`
2. `Quizmoto_Enhancement_and_Reliability_Blueprint.md`

Read both documents completely before modifying any code. Then inspect the actual repository, package files, scripts, migrations, configuration, tests, and deployment files. Do not rely only on the documents.

## 1.1 Source-of-truth hierarchy

Use this hierarchy whenever information conflicts:

1. The actual repository is the source of truth for what currently exists.
2. `PROJECT_DOCUMENTATION.md` is the documented description of the current system.
3. `Quizmoto_Enhancement_and_Reliability_Blueprint.md` defines the intended future architecture, implementation order, controls, and exit gates.
4. An explicit task prompt defines what is authorized in the current phase.

When the repository differs from the documentation, do not silently choose one. Record the mismatch in the repository audit and decision log.

## 1.2 Primary objective

Improve the project phase by phase while protecting all working functionality. The product must become more reliable, testable, secure, maintainable, scalable, and commercially usable without destabilizing live gameplay.

Do not attempt all phases in one uncontrolled change. Work on one phase at a time and one task at a time inside that phase.

## 1.3 Anti-hallucination rules

These rules are mandatory:

1. Never claim a file, route, model, dependency, test, command, database table, socket event, feature, environment, or deployment capability exists until you verify it in the repository.
2. Never claim a test passed unless you actually ran it and received a passing result.
3. Never fabricate terminal output, screenshots, logs, coverage, benchmark results, commit hashes, or completion percentages.
4. Use the exact labels `VERIFIED`, `NOT VERIFIED`, `NOT IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, or `BLOCKED`.
5. When blocked by a missing credential, service, environment, fixture, package, or decision, document the exact blocker and complete every non-blocked part.
6. Do not invent missing business rules. Record them as an open decision and use the safest backward-compatible assumption only when implementation cannot continue otherwise.
7. Do not replace production logic with mocks merely to make tests pass. Mocks are permitted only inside controlled tests.
8. Do not suppress, skip, weaken, delete, or mark tests as flaky merely to obtain a green result.
9. Do not hide errors with broad `try/catch`, empty catches, arbitrary delays, page reloads, or endless retries.
10. Do not change unrelated modules while completing a focused task.
11. Do not perform broad rewrites when an incremental extraction or adapter can preserve behaviour.
12. Do not expose secrets, JWTs, OAuth credentials, personal information, answer keys before reveal, or sensitive data in logs or reports.
13. Do not edit production `.env` values. Provide `.env.example` additions and migration notes instead.
14. When using an external library or framework behaviour, verify it against the installed version or current official documentation before relying on it.

## 1.4 Mandatory architecture rules

Follow the blueprint requirements throughout implementation:

- The server is authoritative for session state, score, timing, role, ownership, and answer eligibility.
- Session transitions must eventually flow through one strict server-side state machine and `SessionCommandService`.
- Critical commands must become idempotent and use command IDs, expected state versions, validation, authorization, acknowledgements, bounded retry behaviour, and persistence.
- Critical events must use versioned contracts and include identifiers needed for diagnosis and recovery.
- PostgreSQL is the intended production source of truth. Do not treat in-memory state or socket rooms as the only source of truth.
- Answers must be effectively-once using a round-specific database uniqueness rule and transactional scoring.
- Clients must ignore stale state and request canonical recovery when state versions are missing or uncertain.
- Long-running work such as reports, document parsing, imports, exports, certificates, and bulk generation must move toward durable, retryable, idempotent jobs.
- Risky new behaviour must be protected by feature flags.
- Database changes must be backward compatible and include migration and rollback plans.
- API and socket contracts must be versioned and tested.
- User interfaces must handle loading, timeout, error, empty, offline, reconnecting, recovery, and unsupported-version states.
- Mobile, desktop, keyboard, reduced-motion, and accessibility behaviour must be considered.

## 1.5 Required repository documentation structure

Before implementation, create this structure if it does not exist:

```text
docs/implementation/
  00_MASTER_IMPLEMENTATION_TRACKER.md
  01_REPOSITORY_AUDIT.md
  02_REQUIREMENTS_TRACEABILITY_MATRIX.md
  03_REGRESSION_TEST_MATRIX.md
  04_DECISION_LOG.md
  05_RISK_REGISTER.md
  06_IMPLEMENTATION_CHANGELOG.md
  phases/
    phase-00/
      PHASE_00_PLAN.md
      PHASE_00_COMPLETION_REPORT.md
      TEST_EVIDENCE.md
      MANUAL_QA.md
      ROLLBACK_PLAN.md
```

Create equivalent folders for later phases only when those phases begin.

## 1.6 Master implementation tracker requirements

`00_MASTER_IMPLEMENTATION_TRACKER.md` must contain one row for every blueprint phase and task with at least these fields:

| Requirement ID | Phase | Task | Source section | Priority | Status | Files/Modules | Tests | Evidence | Commit/Change Reference | Blocker/Risk | Next Action |

Rules:

- Give every task a stable ID such as `P0-T01`, `P1-T03`, and `P5-T07`.
- Initial status must be based on repository verification, not assumption.
- Update the tracker after every completed task.
- Do not mark a task complete without code or documentation evidence and required passing tests.
- Keep partially implemented and blocked tasks visible.

## 1.7 Requirements traceability

`02_REQUIREMENTS_TRACEABILITY_MATRIX.md` must map every authorized requirement to:

- source document and section;
- implementation files;
- database/API/socket impact;
- automated tests;
- manual checks;
- feature flag;
- migration;
- completion evidence;
- final status.

No requirement may disappear between planning and completion.

## 1.8 Required workflow for every task

For each task, follow this exact sequence:

### Step A — Inspect

- Read the relevant source files completely.
- Identify current behaviour and dependencies.
- Reproduce the existing behaviour or defect.
- Record exact evidence.

### Step B — Plan

Before changing code, add a task plan containing:

- objective;
- current verified behaviour;
- files/modules affected;
- database impact;
- REST API impact;
- socket contract impact;
- authentication and authorization impact;
- security risks;
- migration and rollback approach;
- tests to add or update;
- acceptance criteria;
- out-of-scope items.

### Step C — Protect existing behaviour

- Create or update a test that captures current required behaviour before refactoring it.
- For a bug, add a failing regression test that reproduces the bug before fixing it whenever technically possible.

### Step D — Implement the smallest safe change

- Work only on the current task.
- Preserve backward compatibility.
- Use feature flags for high-risk changes.
- Avoid unrelated formatting and refactoring.

### Step E — Verify

Run all applicable checks using real commands available in the repository:

1. dependency installation using lock files;
2. lint and format checks;
3. type checks when configured;
4. unit tests;
5. database integration tests;
6. Socket.IO tests;
7. frontend component tests;
8. Playwright golden-flow tests;
9. production builds;
10. migration validation;
11. security/dependency checks when configured;
12. manual desktop and mobile smoke checks.

If a command does not exist, mark it `NOT IMPLEMENTED`, propose the appropriate script, and add it only when it is part of the authorized task.

### Step F — Review

Review the change for:

- regression risk;
- authorization gaps;
- race conditions;
- duplicate processing;
- stale events;
- reconnect behaviour;
- transaction boundaries;
- rollback safety;
- data leakage;
- accessibility;
- mobile behaviour;
- observability and diagnostic usefulness.

### Step G — Document

Update the tracker, traceability matrix, test matrix, decision log, risk register, implementation changelog, and current phase report.

## 1.9 Definition of Done

A task is complete only when all applicable conditions are satisfied:

- acceptance criteria are written and verified;
- required code is implemented;
- tests are added or updated;
- all required tests pass;
- authorization and security are reviewed;
- error, timeout, retry, reconnect, and recovery behaviour is handled;
- mobile and desktop behaviour is checked;
- accessibility impact is checked;
- telemetry or structured diagnostic information is added where relevant;
- migrations are backward compatible;
- rollback instructions exist;
- documentation is updated;
- the golden flow passes;
- no known required test is failing.

A task must remain `PARTIALLY IMPLEMENTED` or `BLOCKED` when any mandatory condition is missing.

## 1.10 Phase discipline

- Do not mix tasks from different phases.
- Do not begin a later phase merely because it is easy or visually attractive.
- Complete tasks in dependency order.
- Run the phase exit gate after all phase tasks.
- Produce the phase completion report.
- Do not declare the phase complete when its exit gate fails.
- Do not begin the next phase until it is explicitly authorized in a new prompt.

## 1.11 Required phase completion report

At the end of every phase, create `PHASE_XX_COMPLETION_REPORT.md` with these sections:

1. Phase objective
2. Starting repository condition
3. Authorized scope
4. Completed requirements
5. Partially completed requirements
6. Blocked requirements
7. Requirements traceability summary
8. Exact files created, modified, moved, or deleted
9. Database migrations and rollback instructions
10. REST API changes
11. Socket event/contract changes
12. Security and authorization review
13. Automated tests added
14. Exact test commands executed
15. Test results with pass/fail counts
16. Coverage results, only when actually measured
17. Manual desktop checks
18. Manual mobile checks
19. Accessibility checks
20. Performance or load checks
21. Defects found but not fixed
22. Known risks and limitations
23. Feature flags and default states
24. Deployment notes
25. Rollback procedure
26. Evidence paths for logs, screenshots, reports, fixtures, and test artifacts
27. Exit-gate checklist
28. Recommended next phase
29. Truthfulness declaration

Use this truthfulness declaration:

> This report distinguishes verified, partially implemented, blocked, and unverified work. No test, result, file, command, migration, or feature is reported as completed without repository or execution evidence.

## 1.12 Communication requirements

During work:

- Give concise progress updates after meaningful milestones.
- Report defects as soon as they are verified.
- Do not provide vague statements such as “everything is fixed.”
- Use requirement IDs and file paths.
- When a test fails, state the failure, cause if known, and next corrective action.

At the end of the authorized task or phase, return:

1. a concise summary in chat;
2. the path to the phase completion report;
3. the path to the updated master tracker;
4. the exact tests run and their outcome;
5. all blockers and remaining risks;
6. the exact next recommended prompt.

Acknowledge these governance rules, inspect the repository and both governing documents, create the implementation documentation structure, and wait for the first phase-specific instruction. Do not modify application behaviour yet.

---

# 2. Phase 0 Execution Prompt

Begin **Phase 0 only: Repository Baseline, Defect Reproduction, and Regression Safety Net**.

Do not implement Phase 1 session architecture changes yet. Do not add commercial features, document question generation, new game modes, billing, question-bank expansion, or broad UI redesigns.

## Phase 0 objective

Create a trustworthy baseline and an automated safety net that proves whether the existing application still works after future changes. Reproduce and document the reported case where players can remain stuck on the **Starting Session** screen.

## Authorized Phase 0 tasks

### P0-T01 — Complete repository audit

Inspect and document:

- frontend and backend entry points;
- package scripts and lock files;
- actual framework and dependency versions;
- database dialects and migrations;
- models and relationships;
- REST routes and middleware;
- Socket.IO initialization and every socket event;
- host and player authentication flows;
- session creation and lifecycle;
- question start/end flow;
- scoring and answer persistence;
- host and player reconnection;
- report generation;
- Redis use, if any;
- Docker, Nginx, Render, CI, and deployment files;
- existing tests and coverage;
- environment variables without exposing secret values.

Compare the repository with `PROJECT_DOCUMENTATION.md`. Record every mismatch as `VERIFIED`, `NOT VERIFIED`, `PARTIALLY IMPLEMENTED`, or `NOT IMPLEMENTED`.

### P0-T02 — Establish deterministic local/test environment

Create or repair documented commands for a repeatable test environment using the repository's supported stack.

Requirements:

- deterministic test configuration;
- isolated test database;
- deterministic seed quiz;
- deterministic host test account or safe authentication bypass restricted to test environment;
- two deterministic players;
- cleanup before and after tests;
- no dependency on production credentials;
- no test data written into production databases;
- `.env.example` documentation for test-only values;
- reproducible setup instructions.

Do not weaken production authentication.

### P0-T03 — Create the golden-flow browser test

Build an automated Playwright or equivalent end-to-end golden flow for the existing behaviour. It must cover:

1. application loads;
2. host authenticates in the test environment;
3. dashboard displays quizzes;
4. host selects the deterministic quiz;
5. one session is created;
6. PIN is visible and valid;
7. Player A joins;
8. Player B joins;
9. host sees both players;
10. host starts the first question;
11. both players leave the starting state;
12. Player A submits the correct answer;
13. Player B submits an incorrect answer;
14. duplicate submission is rejected or returns the original result safely;
15. question result is shown;
16. leaderboard is correct;
17. Player A disconnects or reloads;
18. Player A reconnects and receives the correct current state, score, streak, and answer status;
19. next state transition works;
20. game finishes once;
21. final results are visible;
22. report/session history becomes visible or is queued according to existing behaviour;
23. test data is cleaned up.

Run the golden flow in at least:

- desktop Chromium viewport;
- a common mobile viewport.

Capture trace, screenshot, video, console errors, failed network requests, and server logs on failure when supported by the test framework.

### P0-T04 — Reproduce the Starting Session defect

Investigate the reported condition where a player remains indefinitely on the Starting Session screen.

Test at least these scenarios:

- normal start;
- host double-clicks Start;
- player joins immediately before Start;
- player joins immediately after Start;
- player refreshes during the countdown;
- player disconnects before `question_started`;
- player reconnects after the event was emitted;
- socket event is delayed;
- socket event is duplicated;
- REST session creation succeeds but the next socket event is missed;
- host refreshes during start;
- server process restarts during a transient state, when practical in the test environment;
- mobile browser background/foreground transition.

Do not guess the root cause. Provide exact reproduction steps, logs, events, database state, and affected files. Add one or more failing regression tests for every reliably reproduced cause.

Phase 0 may fix only a very small, low-risk defect when all of these are true:

- the root cause is verified;
- the fix is narrowly scoped;
- a failing regression test exists first;
- the fix does not begin the Phase 1 architecture refactor;
- the full golden flow passes afterward.

Otherwise, document the defect for Phase 1.

### P0-T05 — Build the regression test matrix

Create `03_REGRESSION_TEST_MATRIX.md` covering at least:

- host authentication;
- player authentication;
- quiz CRUD;
- session creation;
- PIN and QR joins;
- duplicate nickname handling;
- lobby updates;
- start transition;
- countdown and timer synchronization;
- answer validation;
- duplicate answers;
- score and streak calculation;
- result and leaderboard;
- next question;
- host reconnect;
- player reconnect;
- stale/duplicate socket events;
- game finish;
- analytics/report visibility;
- desktop/mobile;
- error and timeout states;
- authorization failures;
- rate limits when already implemented.

For each row include test level, fixture, expected result, automated/manual status, test file, last result, and evidence.

### P0-T06 — Establish CI quality gate

Create or repair a CI workflow appropriate for the repository that runs the checks actually available after Phase 0:

- locked dependency installation;
- lint;
- formatting check if configured;
- type check if configured;
- unit and integration tests if present;
- Socket.IO tests if present;
- golden-flow E2E tests;
- frontend and backend production builds;
- database migration validation if migrations exist;
- artifact upload for failed E2E traces and screenshots.

Do not pretend unavailable test categories exist. Mark missing categories in the tracker for their planned phase.

## Phase 0 prohibited actions

Do not:

- rewrite `socketHandlers.js` broadly;
- introduce the final Session Engine V2;
- rename existing socket events;
- change the scoring formula;
- change user-facing game behaviour except an approved narrow bug fix;
- migrate the full production database architecture;
- introduce Redis Streams or a job queue;
- implement the document-to-question generator;
- implement new monetization or institution features;
- delete legacy code before replacement behaviour is proven.

## Phase 0 exit gate

Phase 0 passes only when:

- the repository audit is complete;
- documentation mismatches are recorded;
- deterministic test data and cleanup work;
- the golden flow can run repeatedly in the test environment;
- desktop and mobile golden flows pass, or every remaining failure is honestly documented as a verified blocker;
- the Starting Session issue has verified reproduction evidence or a documented test matrix showing attempted scenarios;
- failing regression tests exist for reproducible session-start defects;
- CI runs the established baseline checks;
- no required working behaviour was knowingly broken;
- `PHASE_00_COMPLETION_REPORT.md` is complete;
- the master tracker and traceability matrix are updated.

If the golden flow cannot pass because of existing defects, do not mark the phase complete. Mark it `PARTIALLY IMPLEMENTED`, list the exact defects, and propose the smallest Phase 0 corrective tasks before Phase 1.

## Required response after Phase 0

Return:

1. Phase 0 status: `COMPLETE`, `PARTIALLY IMPLEMENTED`, or `BLOCKED`.
2. Exact requirements completed by ID.
3. Exact files changed.
4. Exact commands run.
5. Test results and artifact paths.
6. Starting Session findings.
7. Remaining defects and risks.
8. Paths to:
   - `00_MASTER_IMPLEMENTATION_TRACKER.md`
   - `01_REPOSITORY_AUDIT.md`
   - `02_REQUIREMENTS_TRACEABILITY_MATRIX.md`
   - `03_REGRESSION_TEST_MATRIX.md`
   - `phases/phase-00/PHASE_00_COMPLETION_REPORT.md`
9. The recommended Phase 1 task prompt, but do not begin Phase 1.

Start Phase 0 now.

---

# 3. Continuation Prompt Template

Use this only after reviewing the previous phase report.

Continue the Quizmoto improvement program using the existing governance rules, master tracker, traceability matrix, decision log, risk register, regression matrix, and previous phase completion report.

Authorize **Phase [NUMBER]: [PHASE NAME] only**.

Before changing code:

1. Read both governing documents again where relevant.
2. Read the previous phase completion report.
3. Verify the previous phase exit gate still passes on the current branch.
4. Run the golden flow once as a baseline.
5. Update the master tracker with the exact authorized tasks for this phase.
6. Create `docs/implementation/phases/phase-[NUMBER]/PHASE_[NUMBER]_PLAN.md`.

Implement tasks one at a time in dependency order. For each task, use the inspect, plan, protect, implement, verify, review, and document workflow. Do not work on later phases.

The authorized tasks and exit gate are exactly those listed under Phase [NUMBER] in `Quizmoto_Enhancement_and_Reliability_Blueprint.md`, with these additional constraints:

- [INSERT ANY PHASE-SPECIFIC BUSINESS DECISIONS OR LIMITS]
- Preserve all existing behaviour unless the requirement explicitly changes it.
- Add regression coverage before changing a protected flow.
- Keep risky behaviour behind a disabled-by-default feature flag.
- Do not mark the phase complete if any mandatory test or exit gate fails.

At completion, create `PHASE_[NUMBER]_COMPLETION_REPORT.md`, update all implementation documents, and return the exact evidence, remaining risks, and recommended next-phase prompt. Do not begin the next phase.

---

# 4. Recommended phase sequence

Use the phase names and task details from the blueprint. The recommended overall order is:

1. Phase 0 — Repository baseline and golden-flow regression safety net.
2. Phase 1 — Bulletproof session engine and Starting Session recovery.
3. Phase 2 — PostgreSQL production hardening and durable infrastructure.
4. Phase 3 — Background workers, reports, imports, and operational reliability.
5. Phase 4 — Observability, diagnostics, release controls, and production readiness.
6. Phase 5 — Deterministic document-to-question engine and structured question bank.
7. Phase 6 — Self-paced learning and new interaction types.
8. Phase 7 — Institution platform, tenancy, roles, analytics, billing, and governance.
9. Phase 8 — Marketplace, integrations, multilingual workflows, and optional metered AI.

Do not authorize a later phase solely because it appears commercially attractive. Stability and test gates protect every later investment.
