# Phase 02 Reliability Acceptance (P2-T11)

**Blueprint:** §4.14  
**Date:** 2026-08-03

## Automated suite

```bash
cd server
npm test -- --grep "Reliability Acceptance"
# or full unit suite:
npm test
```

| ID | Scenario | Automated test |
|---|---|---|
| A1 | Host double-start same commandId → one effect | reliability.acceptance.test.js |
| A2 | Second start while open rejected | same |
| A3 | Double answer submit → one score | same |
| A4 | Stale stateVersion → conflict | same |
| A5 | Happy path dual-write legacy status | same |
| A6 | Stuck STARTING remediated by watchdog | same |
| A7 | Host lease held by first owner | same |
| A8 | Player recovery hides correctIndex | same |
| A9 | Flag OFF → commands disabled | same |

## Manual / E2E (operator must run)

With **`NEW_SESSION_ENGINE` unset/false** (production default):

```bash
# from repo root
npm run test:critical
# and/or
npm run test:e2e
```

Checklist:

- [ ] Golden flow desktop passes
- [ ] After question ends, correct/incorrect screen appears
- [ ] Host can start next question
- [ ] End game shows final leaderboard
- [ ] Reconnect host/player mid-game restores UI (socket recovery)

Optional V2 (internal only):

```bash
NEW_SESSION_ENGINE=true npm test -- --grep "Phase 2"
```

Do **not** enable on production until this checklist is green three times.

## Status

| Item | Status |
|---|---|
| Automated reliability suite | **ADDED** |
| Operator golden-flow evidence | **PENDING** (run locally / CI) |
| Phase 2 exit gate | **NOT MET** until operator evidence + completion report |
