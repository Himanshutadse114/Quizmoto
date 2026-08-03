# Phase 03 — Postgres Backup and Restore Runbook (P3-T07)

**Status:** DONE  
**Date:** 2026-08-04  
**Audience:** operators deploying Quizmoto on PostgreSQL (Render, Docker, self-hosted)

---

## 1. Goals

- Document how to take a consistent logical backup of the production Postgres database.
- Document how to restore into a **staging** or **empty** target (never overwrite prod without explicit approval).
- Provide scripts under `scripts/` for dump and restore dry-run.
- State **aspirational** RPO/RTO until measured in a real drill.

**Does not** change live play code paths. Backups run outside the Node process.

---

## 2. Prerequisites

| Tool | Purpose |
|------|---------|
| `pg_dump` / `pg_restore` / `psql` | PostgreSQL client tools (same major version as server preferred) |
| Network access to DB host | Render External Database URL, or VPC / allowlisted IP |
| Credentials | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` (or `DATABASE_URL`) |

On Render: use the **External Database URL** from the Postgres service dashboard. Prefer SSL (`sslmode=require`).

Quizmoto env mapping (see `server/config/database.js`):

```text
DB_DIALECT=postgres
DB_HOST=...
DB_PORT=5432
DB_NAME=...
DB_USER=...
DB_PASS=...
DB_SSL=true   # typical for Render
```

---

## 3. Backup (logical dump)

### 3.1 Recommended format

Use **custom format** (`-Fc`) so restore can be selective and parallel:

```bash
pg_dump -Fc --no-owner --no-acl \
  -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
  -f "backups/quizmoto_$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Plain SQL alternative (human-readable, larger):

```bash
pg_dump --no-owner --no-acl \
  -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" \
  -f "backups/quizmoto_$(date -u +%Y%m%dT%H%M%SZ).sql"
```

### 3.2 Script

```bash
# from repo root
export DB_HOST=... DB_PORT=5432 DB_NAME=... DB_USER=... DB_PASS=...
# optional: export PGPASSWORD="$DB_PASS"
bash scripts/postgres_backup.sh
```

Output lands in `backups/` (gitignored recommendation — do not commit dumps).

### 3.3 What is included

Logical dump includes application tables managed by Sequelize (e.g. `Users`, `Quizzes`, `Questions`, `GameSessions`, `Players`, `PlayerAnswers`, Phase 2 tables `Rounds` / `SessionEvents` / `IdempotencyRecords`, `PlayerProfiles`, etc.).

**Not** included: local disk report artifacts under `server/data/artifacts/` (object storage). Back those up separately if `STORAGE_DRIVER=local`.

---

## 4. Restore

### 4.1 Safety rules

1. **Never** restore over production without a written go-ahead and a fresh pre-restore dump.
2. Prefer restore into a **new** database or staging instance.
3. Stop the API/worker only if restoring onto a DB that live traffic is using (maintenance window).
4. After restore, run app once with `DB_DIALECT=postgres` and confirm `/health` and one login.

### 4.2 Custom-format restore

```bash
# target must exist
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" quizmoto_restore_test

pg_restore --no-owner --no-acl --clean --if-exists \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d quizmoto_restore_test \
  backups/quizmoto_YYYYMMDD.dump
```

### 4.3 Dry-run (list only)

```bash
pg_restore -l backups/quizmoto_YYYYMMDD.dump | head
# or
bash scripts/postgres_restore.sh --dry-run backups/quizmoto_YYYYMMDD.dump
```

### 4.4 Script

```bash
export DB_HOST=... DB_PORT=5432 DB_USER=... DB_PASS=...
export RESTORE_DB=quizmoto_restore_test   # must not be production name without confirmation
bash scripts/postgres_restore.sh backups/quizmoto_YYYYMMDD.dump
```

The restore script **refuses** to target a database name matching common production names unless `ALLOW_PROD_RESTORE=yes` is set.

---

## 5. Render-specific notes

1. Create a one-off shell or use a laptop with `pg_dump` and the External URL.
2. Schedule: until automated, take a dump **before** major migrations and at least weekly.
3. Store dumps off-instance (S3, encrypted drive). Do not leave dumps only on the web service filesystem.
4. Render may offer point-in-time recovery on paid Postgres plans — treat that as complementary, not a replacement for documented `pg_dump` drills.

---

## 6. Drill checklist (evidence)

Run at least once against **staging** or a throwaway DB:

| Step | Action | Evidence |
|------|--------|----------|
| 1 | `bash scripts/postgres_backup.sh` against staging | Dump file size > 0; exit 0 |
| 2 | `bash scripts/postgres_restore.sh --dry-run <dump>` | TOC listed; exit 0 |
| 3 | Restore into empty `quizmoto_restore_test` | `pg_restore` exit 0 |
| 4 | Point a local server at restore DB; hit `/health` | 200 OK |
| 5 | Spot-check row counts (`Users`, `Quizzes`, `GameSessions`) | Counts match pre-dump notes |

Record date, operator, dump filename, and pass/fail in `PHASE_03_PROGRESS.md` or incident notes.

If no Postgres is available in CI, mark drill **BLOCKED** with reason (honest gate for Phase 3 completion).

---

## 7. Aspirational RPO / RTO

| Metric | Target (aspirational) | Measured |
|--------|----------------------|----------|
| RPO (max data loss) | ≤ 24h (daily dump) | **Not measured** — improve with automated daily dump + offsite |
| RTO (time to restore staging) | ≤ 2h | **Not measured** — depends on dump size and network |

Revisit after first successful timed drill.

---

## 8. Rollback relation

- Backups do **not** replace feature-flag rollback (`REPORTS_ASYNC=false`, etc.).
- Use this runbook for data recovery; use `PHASE_03_ROLLBACK_PLAN.md` for feature/config rollback.

---

## 9. Completion criteria (P3-T07)

- [x] Runbook committed under `docs/implementation/phases/phase-03/`
- [x] `scripts/postgres_backup.sh` and `scripts/postgres_restore.sh` committed
- [ ] Operator drill evidence (or BLOCKED note) when Postgres staging is available
