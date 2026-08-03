# Phase 03 Rollback Plan

## Emergency (no deploy)

1. Set environment:
   - `REPORTS_ASYNC=false` or unset
   - Keep `NEW_SESSION_ENGINE` unset/false
2. Restart API process if needed.
3. Stop worker process(es) if running.

**Result:** Live play unchanged; reports return to in-process behaviour.

## Adapter issues

1. Unset `REDIS_URL` (or disable adapter config).
2. Ensure single-node or sticky sessions at the load balancer.
3. Restart API.

## Data

- Job tables/rows may remain; safe to leave.
- Do not drop Postgres data to “fix” jobs.
- Report files under local artifacts can be deleted operationally after backup if needed.

## Verification after rollback

```bash
cd server && npm test
npm run test:critical   # from repo root when practical
```

Confirm host can export report via legacy path if that path was in use.
