# Production release checklist

Do not tick items you have not verified on the target environment.

## Local verification (Phase 11)

- [x] `npm test` — 80 passed
- [x] `npx tsc --noEmit`
- [ ] `npm run lint` — 26 pre-existing React Compiler errors (Date.now / setState-in-effect / memo). None in Phase 11 files. Not a release blocker.
- [x] `npm run build`
- [x] `SMOKE_BASE_URL=http://localhost:3000 npm run smoke`
- [ ] No Playwright browser matrix in CI (not installed). Manually spot-check Chrome, Edge, and a phone-width viewport: login, marketplace search, cart, POS on a **test** shop

## Isolated accounts (manual, four logins)

Use separate **customer**, **shop owner**, **cashier**, and **Super Admin** accounts on staging. Do not use production data.

- [ ] Customer: cart persists after refresh/login; grouped by shop; live price shown if the shop changed it; stock cap; WhatsApp checkout pending
- [ ] Customer: enquiry/booking requires login and appears only on that shop
- [ ] Shop owner: catalogue, inventory adjust, POS sale, receipt, no duplicate sale on double-tap
- [ ] Cashier: POS and receipts yes; settings, staff, catalogue no
- [ ] Super Admin: control centre; cannot be impersonated from shop settings
- [ ] Shop A cannot open Shop B products, sales, customers, or inventory
- [ ] Locked package tools stay locked for that shop’s current plan

## Security and isolation

- [ ] Staging and production use different Supabase projects
- [ ] Service role key is server-only
- [ ] `/shop`, `/customer`, `/admin` redirect when signed out
- [ ] Anonymous `POST /api/admin/users` is 401/403
- [ ] Anonymous `PUT /api/cart` and `POST /api/shop/pos` are 401/403
- [ ] `robots.txt` disallows `/admin`, `/shop`, `/customer`, `/api`
- [ ] POS / sale / receipt catalogue lines use server prices after `20261031210000`
- [ ] This release does **not** claim the app is vulnerability-free

## Data

- [ ] Migrations through `20261031210000` applied on that project
- [ ] Backups / PITR confirmed in the Supabase dashboard (`docs/disaster-recovery.md`)
- [ ] No production data used as test fixtures

## Operations

- [ ] `CRON_SECRET` set; hourly loyalty cron and weekly Stebo cron authorized
- [ ] `/api/health` returns 200 after deploy
- [ ] Support phone and email reachable (`+263 71 503 4314`, `lagecto@outlook.com`)
- [ ] Terms, privacy, and marketplace rules pages return 200

## Public site

- [ ] Home, marketplace, shops, plans, how-it-works, login, register-shop
- [ ] `NEXT_PUBLIC_SITE_URL` is the live https origin
- [ ] Logo and package prices unchanged (Thabi / Kristen / Sandra + Free)

## Rollback

- [ ] Previous git revision identified
- [ ] Restore steps in `docs/disaster-recovery.md` read by the person on call
