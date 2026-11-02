# Environments

Keep three isolated stacks. Do not point local or staging at production Supabase.

| | Local | Staging | Production |
|---|---|---|---|
| App | `npm run dev` | Preview deploy | Live domain |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Staging https URL | `https://lagecto.co.zw` (or the live host) |
| Supabase | Dev project | Staging project | Production project |
| `CRON_SECRET` | Optional | Distinct secret | Distinct secret |
| Payments | `sandbox` / `test` | sandbox | stay sandbox until online payments are explicitly enabled |

## Variables

See `.env.example`. Public (`NEXT_PUBLIC_*`) values are visible in the browser. Never put `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, or Paynow keys in `NEXT_PUBLIC_*`.

`.env*` is gitignored except `.env.example`.

## Production flags

- `NODE_ENV` is `production` on `next start` / Vercel.
- Auth cookies are `Secure` on HTTPS (`src/lib/security.ts`).
- HSTS is set on HTTPS responses.
- Debug setup query `?setup=1` only appears when Supabase env is missing; that must not happen in production.
