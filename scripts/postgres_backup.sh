#!/usr/bin/env bash
# P3-T07: logical Postgres backup for Quizmoto
# Usage:
#   export DB_HOST DB_USER DB_PASS DB_NAME [DB_PORT]
#   # or: export DATABASE_URL=postgres://user:pass@host:port/db
#   bash scripts/postgres_backup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/quizmoto_${STAMP}.dump"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install PostgreSQL client tools." >&2
  exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Backing up via DATABASE_URL -> $OUT_FILE"
  pg_dump -Fc --no-owner --no-acl "$DATABASE_URL" -f "$OUT_FILE"
else
  : "${DB_HOST:?Set DB_HOST or DATABASE_URL}"
  : "${DB_USER:?Set DB_USER or DATABASE_URL}"
  : "${DB_NAME:?Set DB_NAME or DATABASE_URL}"
  DB_PORT="${DB_PORT:-5432}"
  export PGPASSWORD="${DB_PASS:-${PGPASSWORD:-}}"
  echo "Backing up ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} -> $OUT_FILE"
  pg_dump -Fc --no-owner --no-acl \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$OUT_FILE"
fi

SIZE="$(wc -c < "$OUT_FILE" | tr -d ' ')"
echo "OK: wrote $OUT_FILE ($SIZE bytes)"
if [[ "$SIZE" -lt 100 ]]; then
  echo "WARNING: dump is unusually small; verify credentials and DB contents." >&2
fi
