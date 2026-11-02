# Deployment

## Install and local setup

```bash
npm install
copy .env.example .env.local
# fill keys from the development Supabase project
npm run dev
```

Open http://localhost:3000. First admin: create the Auth user, then set `public.users.role = 'admin'` in SQL.

## Database migrations

In the Supabase SQL editor, run `supabase/migrations/` **in filename order** on that environment's project. Do not run production SQL from this chat. Later files in this tree are additive (functions, policies, indexes).

Confirm especially:

- `20261031100000`–`20261031130000` security
- `20261031140000` indexes and `product_prices_for_ids`
- `20261031160000` smart cart
- `20261031190000` POS server prices
- `20261031200000` admin control centre
- `20261031210000` sale/receipt catalogue prices and customer-id sanitising

Until `20261031140000` is applied, catalogue promo prices fall back to list price.
Until `20261031210000` is applied, sale/receipt edits can still honour a client unit price.

## Staging

1. Separate Supabase project and Vercel (or host) environment.
2. Set env vars from `.env.example` using staging values.
3. Apply migrations to staging.
4. `npm run build` must succeed.
5. `npm test` and `SMOKE_BASE_URL=<staging> npm run smoke`.

## Production

1. Set production env vars on the host. `NEXT_PUBLIC_SITE_URL` must be the public https origin so WhatsApp/Open Graph cards work.
2. Set `CRON_SECRET`. Vercel Cron uses `Authorization: Bearer $CRON_SECRET`.
3. Apply any pending migrations during a maintenance window.
4. Deploy the git revision that passed staging.
5. Smoke: `/api/health`, `/`, `/marketplace`, `/login`, `/support/terms`, one storefront, login on a test shop.

## Monitoring and logs

- Health: `GET /api/health` (`ok` / `degraded`, no secrets).
- App errors: JSON lines (`ts`, `level`, `scope`, optional `requestId`). Redacts tokens, emails, phones, UUIDs.
- Forward host logs (Vercel Logs). This repo does not ship Sentry.

## Troubleshooting

| Symptom | Check |
|---|---|
| `?setup=1` on login | Missing `NEXT_PUBLIC_SUPABASE_*` |
| Health 503 | Supabase URL/anon key or Auth health |
| Cron no-ops | `CRON_SECRET` mismatch |
| Promo prices = list price | Migration `20261031140000` |
| OG cards wrong | `NEXT_PUBLIC_SITE_URL` |

## Rollback

1. Redeploy the previous git revision.
2. Do not reverse SQL unless you have a reviewed down-migration. Prefer app rollback.
3. Full restore: `docs/disaster-recovery.md`.
