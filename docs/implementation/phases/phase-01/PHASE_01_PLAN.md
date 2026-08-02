# Phase 01 Implementation Plan (Amended)

## Goal Description
Phase 1 focuses on extracting the monolithic `socketHandlers.js` into safe, isolated, and testable modules while enforcing PostgreSQL integration tests and Socket.IO payload schema validation (Joi). We will ensure the E2E golden flow and socket contracts remain untouched.

## Revised Extraction Strategy & Required Modules

### 1. `server/services/ScoringService.js`
- **Pure deterministic logic only.**
- Computes time-based points, streaks, multipliers, and score outcomes.
- Contains NO Sequelize imports, DB calls, Socket.IO calls, or global mutable state.

### 2. `server/services/AnswerSubmissionService.js`
- **Persistence & orchestration for answering.**
- Validates eligibility, loads current persisted state, calls `ScoringService`.
- Performs atomic DB updates (updates score, streak, and inserts exactly one `PlayerAnswer`).
- Handles the transaction.

### 3. `server/validators/socketSchemas.js`
- Centralized Joi schemas to validate all payloads before business logic execution.

### 4. `server/services/SessionAuthorizationService.js`
- Handles authorization decisions securely.
- Strict separation between token verification, identity resolution, ownership checks, and role/command authorization.
- Returns stable internal error codes.

### 5. `server/services/SessionRecoveryService.js`
- **Strictly read-only canonical state reconstruction.**
- Will NOT modify session state, update socket IDs, or emit Socket.IO events directly.
- Handles role-specific recovery without leaking correct answers prematurely.

### 6. `server/errors/socketErrors.js`
- Establishes a stable error contract/taxonomy (e.g., `VALIDATION_ERROR`, `FORBIDDEN`, `ALREADY_ANSWERED`).
- Prevents leakage of internal SQL/stack-traces to clients.

## Verification & Execution Constraints

1. **Dockerized PostgreSQL Test Infrastructure:**
   - Use `docker-compose.test.yml` for isolated Postgres 15 tests.
   - Clean setup/teardown; no production credentials.
2. **Baseline Coverage & Characterization Tests:**
   - Capture current Socket.IO contracts in `SOCKET_CONTRACT_BASELINE.md`.
   - Write characterization tests for existing behavior (e.g., scoring logic, duplicate submissions) *before* any extraction.
   - Establish baseline coverage metrics.
3. **Incremental Execution Checkpoints:**
   - Extraction will be performed iteratively (Scoring -> Validation -> Authorization -> Recovery -> Errors).
   - After each module: Run unit, integration, and critical E2E suites. Measure coverage.
   - Implement database-level duplicate protection verification.
4. **Strict Orchestration Constraints:**
   - Preserve current transaction boundaries and event ordering (Persist -> Commit -> Emit success).
5. **No UI Changes:**
   - Phase 1 remains completely UI-neutral. No feature expansion.

## Exit Gates
- E2E golden flow passes entirely.
- 3 consecutive passes of `npm run test:critical` (using Postgres for integration where applicable).
- 90% branch coverage on Scoring, Validation, Auth; 85% on Recovery.
- Successful performance comparison showing no N+1 regressions.
