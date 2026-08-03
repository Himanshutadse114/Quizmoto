#!/usr/bin/env bash
# P3-T07: Postgres restore / dry-run for Quizmoto
# Usage:
#   bash scripts/postgres_restore.sh --dry-run path/to/file.dump
#   export DB_HOST DB_USER DB_PASS RESTORE_DB=quizmoto_restore_test
#   bash scripts/postgres_restore.sh path/to/file.dump
set -euo pipefail

DRY_RUN=0
DUMP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run|-n) DRY_RUN=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] <dump-file>"
      exit 0
      ;;
    *) DUMP="$1"; shift ;;
  esac
done

if [[ -z "$DUMP" ]]; then
  echo "ERROR: dump file required" >&2
  echo "Usage: $0 [--dry-run] <dump-file>" >&2
  exit 1
fi

if [[ ! -f "$DUMP" ]]; then
  echo "ERROR: file not found: $DUMP" >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "ERROR: pg_restore not found. Install PostgreSQL client tools." >&2
  exit 1
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY-RUN: listing table of contents for $DUMP"
  pg_restore -l "$DUMP" | head -n 80
  echo "... (truncated if long)"
  echo "OK: dry-run complete (no data written)"
  exit 0
fi

TARGET="${RESTORE_DB:-}"
if [[ -z "$TARGET" ]]; then
  echo "ERROR: set RESTORE_DB to the target database name (not production)." >&2
  exit 1
fi

# Refuse obvious production names unless explicitly overridden
case "$TARGET" in
  kahoot_awareness|quizmoto|quizmoto_prod|production|prod)
    if [[ "${ALLOW_PROD_RESTORE:-}" != "yes" ]]; then
      echo "ERROR: refusing restore into '$TARGET'. Use RESTORE_DB=quizmoto_restore_test" >&2
      echo "       or set ALLOW_PROD_RESTORE=yes only with explicit approval." >&2
      exit 1
    fi
    echo "WARNING: ALLOW_PROD_RESTORE=yes — restoring into $TARGET" >&2
    ;;
esac

: "${DB_HOST:?Set DB_HOST}"
: "${DB_USER:?Set DB_USER}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${DB_PASS:-${PGPASSWORD:-}}"

echo "Restoring $DUMP -> ${DB_USER}@${DB_HOST}:${DB_PORT}/${TARGET}"
pg_restore --no-owner --no-acl --clean --if-exists \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET" \
  "$DUMP" || {
    # pg_restore can exit non-zero on benign notices; surface status
    status=$?
    echo "pg_restore exited with $status — review output above." >&2
    exit "$status"
  }

echo "OK: restore finished into $TARGET"
