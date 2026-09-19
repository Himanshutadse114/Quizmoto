# Free Render database rotation

This runbook protects the POC while it uses a Render Free PostgreSQL database. A free database expires 30 days after creation, so rotate it no later than day 25.

## Automated daily backup

The `Production database backup` GitHub Actions workflow runs daily at 03:00 IST. It:

1. Creates a compressed custom-format archive of the `public` schema.
2. Validates the archive with `pg_restore --list`.
3. Calculates a SHA-256 checksum.
4. Records the source database size and estimated monthly backup transfer in the manifest.
5. Uploads the archive and manifest to R2 over TLS.
6. Retains at least seven daily backups and removes older daily snapshots.

Configure these GitHub Actions repository secrets:

- `PRODUCTION_DATABASE_URL`: the external PostgreSQL URL of the active production database.
- `R2_BACKUP_BUCKET`: preferably a private bucket used only for database backups.
- `R2_ENDPOINT`: the Cloudflare R2 S3 endpoint.
- `R2_BACKUP_ACCESS_KEY_ID`: an R2 token restricted to the backup bucket.
- `R2_BACKUP_SECRET_ACCESS_KEY`: the matching secret.

The workflow emits a warning if daily external backups are projected to transfer more than 2 GB per 31 days. This leaves room within Render's 5 GB Hobby workspace allowance for API and static-site traffic. Normal application database queries must use Render's internal URL and do not consume outbound bandwidth.

After changing databases, update only `PRODUCTION_DATABASE_URL`. Never put database or R2 credentials in repository files.

## Day-25 rotation

1. Trigger `Production database backup` manually and confirm it succeeds.
2. Download that `.dump` and its `.manifest.json` from R2.
3. Check that the downloaded file's SHA-256 equals the manifest value.
4. Put the application in maintenance mode.
5. Delete the expiring free database, create the replacement in the backend's Render region, and copy its external and internal connection URLs.
6. Restore the archive into the replacement using PostgreSQL 17 client tools:

   ```powershell
   $env:RESTORE_DATABASE_URL = '<new Render external URL>'
   $env:DATABASE_BACKUP_FILE = 'C:\path\to\lmsgen-public-....dump'
   $env:CONFIRM_DATABASE_RESTORE = 'RESTORE'
   npm --prefix server run restore:database
   ```

7. Change the backend's production database configuration to the new **internal** Render URL or its corresponding `DB_*` values.
8. Restart the backend and test sign-in, tenants, courses, campaigns, Publica and Quizmoto.
9. Remove maintenance mode.
10. Replace the GitHub `PRODUCTION_DATABASE_URL` secret with the new **external** URL so daily backups continue.

The application must use the internal URL for ordinary traffic. The scheduled backup must use the external URL because GitHub-hosted runners are outside Render's private network.
