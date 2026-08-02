# Goal Description

Phase 0 objective is to establish a trustworthy, repeatable baseline that proves the existing application’s critical flows, reproduces the reported Starting Session failure, and prevents future changes from silently breaking working functionality.

This plan details the implementation strategy for the 11 tasks outlined in the Phase 0 Execution Prompt.

## Proposed Changes

### Task 0.1 & 0.2 — Verify Development Environment and Establish Baseline
- Node.js (v22), npm (v10), and Python (v3.13) versions have been verified.
- The baseline dependencies have been successfully installed.
- We will document the environment details and startup scripts in `docs/implementation/phases/phase-00/TEST_EVIDENCE.md`.

### Task 0.3 — Create Deterministic Test Fixtures
- We will add a `server/utils/testFixtures.js` file with scripts to:
  - Create a deterministic test host account.
  - Insert a deterministic 3-question test quiz into the database.
  - Provide reusable DB cleanup logic (e.g., `TRUNCATE` or `DELETE` queries) to run before/after tests.
  
### Task 0.4 — Add Testing Foundation
- **Backend Tests:** Add `mocha`, `chai`, `supertest` and `socket.io-client` to `server/package.json`.
- **Frontend/E2E Tests:** Add `@playwright/test` to the root or `client` package.json for E2E tests.
- Add npm scripts to both `package.json` files for running these tests (e.g., `test:unit`, `test:integration`, `test:e2e`).

### Task 0.5 — Build Mandatory Golden-flow Test
- We will write a Playwright script `tests/e2e/golden-flow.spec.js` that:
  - Automates 3 browser contexts (Host, Player A, Player B).
  - Navigates through authentication, game creation, lobby, answering, leaderboard, reconnects, and game completion.
  - Generates traces and screenshots upon failure.

### Task 0.6 & 0.7 — Reproduce Starting Session Defect & Add Logging
- Add structured logging to `server/services/socketHandlers.js` (including timestamps, session IDs, event names, and states) to observe the transition from `lobby` to `question`.
- We will use Playwright or manual scripts to simulate edge cases (rapid clicking, instant reconnects, network throttling) to reproduce the "stuck on starting session" bug.
- If a minor code adjustment safely fixes it, we will implement it; otherwise, we'll document it rigorously for Phase 1.

### Task 0.8 — Create Regression Matrix
- Update `docs/implementation/03_REGRESSION_TEST_MATRIX.md` detailing the test coverage boundaries, mapping to the new automated scripts.

### Task 0.9 — Add CI Quality Gate
- Create `.github/workflows/ci.yml` that runs:
  - Dependency installation.
  - Linting (`npm run lint` in client).
  - Backend integration and unit tests.
  - Playwright E2E tests.
  - Archiving of Playwright failure traces.

### Task 0.10 — Perform Manual QA
- We will perform a manual run of the session and document the result in `docs/implementation/phases/phase-00/MANUAL_QA.md`.

### Task 0.11 — Maintain Traceability
- We will update the `00_MASTER_IMPLEMENTATION_TRACKER.md` and `06_IMPLEMENTATION_CHANGELOG.md` along with all other governance documents as tasks are completed.

## User Review Required

- Please confirm if placing the Playwright tests in a root `tests/e2e/` folder is preferred, or if they should reside within the `client/` folder. (We default to a root `tests/e2e/` folder for clarity).
- We will use SQLite as the default test database for deterministic tests unless PostgreSQL is strictly required for Phase 0 E2E test environments. SQLite provides easier isolation and teardown for local CI checks.

## Verification Plan

### Automated Tests
- `npm run test:e2e` will run the Playwright golden flow.
- `npm run test:integration` will test the backend endpoints and socket connections.

### Manual Verification
- We will ensure the repository builds cleanly and that all tests pass.
- We will verify that the CI configuration syntax is correct.
