# Phase 02 Rollback Plan

## Principle

Rollback must not require destructive schema changes. The primary kill-switch is the feature flag `new_session_engine` (default OFF).

## Emergency disable (no deploy)

1. Set environment / config: `NEW_SESSION_ENGINE=false` or equivalent feature-flag store.
2. Restart or hot-reload config if required by hosting.
3. Verify golden flow and live sessions use legacy `status` path only.

## Code rollback

1. Revert to last known-good commit/tag before Phase 2 enablement (or merge of flag-on default).
2. Prefer flag-off over hard revert when new columns are already in production DB.

## Database

- Phase 2 migrations are **additive only**.
- Do **not** DROP `stateVersion`, Round, SessionEvent, or Idempotency tables in emergency.
- Unused columns are harmless.
- Destructive cleanup only in a later expand-and-contract phase after dual-write is retired.

## Verification after rollback

- [ ] `npm run test:critical` passes
- [ ] Host can start session; players leave Starting Session
- [ ] Answer + score + reconnect work
- [ ] No dependency on V2-only fields in the active code path
