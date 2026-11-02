# LaGecto disaster recovery

This document describes recovery for the Next.js app and its **separate** Supabase project. It does not contain credentials.

## What this repo cannot verify

Backups run on the hosted Supabase project, not in this git tree. Confirm the following in the Supabase dashboard before treating production as recoverable:

- Plan includes **daily backups** (Pro and above) or a verified PITR add-on.
- **Point-in-time recovery** is enabled if you need restore to a timestamp, not only a daily snapshot.
- Backup retention matches the business requirement (Supabase Pro default is typically 7 days; PITR retention is plan-specific).
- Storage buckets `shop-media`, `product-media`, and `storefront-media` are included in your backup process. Database dumps do not replace object storage.

If the project is on the free tier, automatic PITR is not available. Upgrade or export a logical dump on a schedule you control.

## Database restore (Supabase)

1. Pause writes: take the app to a maintenance page or stop the hosting deployment.
2. In Supabase: **Database → Backups** (or PITR) → restore to a new project or overwrite after explicit approval.
3. Re-run any migrations that were applied **after** the backup timestamp, in filename order from `supabase/migrations/`.
4. Confirm Auth users still exist. Auth is part of the Supabase project restore; do not recreate accounts from application tables alone.
5. Point production `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` at the restored project.
6. Smoke: `/api/health`, login, one POS sale on a **test** shop, one marketplace product page.

Never restore onto production without a snapshot of the current state. Never test restore with real customer writes.

## Application rollback

1. Redeploy the previous known-good git revision on the host (Vercel or equivalent).
2. Do **not** roll back SQL that already ran unless you have a reviewed reverse migration. Later migrations in this tree are additive (indexes, functions, policies).
3. If a new migration caused the incident, leave the database as-is and revert only the app, unless the SQL is known to be unsafe.

## Storage

Deleted images are not in the Postgres backup. If a bucket is emptied:

1. Restore objects from Supabase storage backups if the plan includes them.
2. Product rows still hold `image` URLs; missing files show the brand placeholder cover.

## Secrets

If keys leak, rotate in the dashboard then update hosting env vars. Do not commit replacements. After rotation, existing sessions may need to sign in again.

## Health and logs

- `GET /api/health` returns `{ ok, status, checks: { app, config, database } }` with no secrets. `503` means the app cannot reach Supabase Auth.
- Application errors log as JSON: `ts`, `level`, `scope`, optional `requestId`, redacted `message`. Forward the host log drain (Vercel Logs, or stdout on the server). This repo does not ship a third-party APM.

## Recurring jobs

Hourly: `GET /api/cron/loyalty` with `Authorization: Bearer <CRON_SECRET>` (expires subscriptions and publishes due news).
Weekly Saturday 04:00 UTC: `/api/cron/stebo-weekly`.

If cron is missing, paid shops can remain on an expired package until a shop dashboard load expires that shop only. Public pages no longer expire subscriptions on every visit.
