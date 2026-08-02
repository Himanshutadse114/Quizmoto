# Phase 1 Rollback Plan

This document defines the safe rollback procedure to revert Phase 1 changes and return the codebase to the **verified Phase 0 checkpoint** (`quizmoto-phase-0-complete`).

## 1. Verified Baseline Tag
The verified Phase 0 checkpoint is tagged as: `quizmoto-phase-0-complete`.
Do **NOT** use `quizmoto-governance-baseline` as the rollback target, as it does not contain the verified Phase 0 defect fixes and test validations.

## 2. Reversion Procedure
Routine rollbacks should avoid destructive commands like `git reset --hard` or broad `git checkout <tag> -- .` to prevent losing untracked context or unintended side effects.

### Step 1: Revert the Phase 1 Commits
Use `git revert` to gracefully back out Phase 1 commits, preserving the history of what was attempted:
```bash
git revert HEAD
# If there are multiple commits, revert a range:
# git revert HEAD~N..HEAD
```

### Step 2: Restore Targeted Files (If Revert Fails/Conflicts)
If the revert is messy or conflicts prevent a clean back-out, restore the specific files from the Phase 0 tag:
```bash
git restore --source=quizmoto-phase-0-complete server/services/socketHandlers.js
git restore --source=quizmoto-phase-0-complete server/routes/quizzes.js
git restore --source=quizmoto-phase-0-complete server/package.json
git restore --source=quizmoto-phase-0-complete server/package-lock.json
```
*Note: Manually remove extracted services (`ScoringService.js`, `AnswerSubmissionService.js`, `SessionTokenService.js`) if restoring targeted files.*

### Step 3: Reinstall Dependencies
Always reinstall dependencies to ensure the node_modules matches the Phase 0 `package-lock.json`:
```bash
cd server
npm ci
cd ../client
npm ci
```

## 3. Database State Rollback
Phase 1 did not alter the database schema or add migrations. Returning to Phase 0 logic requires no database rollback. If running tests locally against SQLite, simply clearing `:memory:` or deleting `database.sqlite` is sufficient.

## 4. Verification After Rollback
Run the Phase 0 test suite to confirm the rollback was successful:
```bash
cd server
npm run test
cd ..
npx playwright test
```
