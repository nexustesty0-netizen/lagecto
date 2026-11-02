# LaGecto architecture

Next.js 16 App Router (TypeScript, Tailwind v4) plus a **separate** Supabase project. This website is not the Expo mobile app and must not share that database.

## Surfaces

- Public marketplace and marketing: `src/app/(public)`
- Shop storefronts: `src/app/s/[slug]`
- Customer, shop OS, admin: `src/app/customer`, `src/app/shop`, `src/app/admin`
- Auth gateway and RPCs: `src/app/api`

## Auth and isolation

Cookie sessions via `@supabase/ssr`. `src/proxy.ts` refreshes the session and sends unsigned visitors away from `/customer`, `/shop`, `/admin`. Role checks run again in layouts and API routes. Shop staff permissions are enforced in `src/lib/shop/staff.ts` and route guards. RLS on Supabase is the last line; the app must still filter by `shop_id` / `customer_id`.

## Messaging

Human chat uses existing `chat_conversations` / `chat_messages` / `chat_reads`. Customers start `shop_customer` threads with a shop. Shop owners and managers share one `shop_admin` support thread per shop with Super Admin. Direct inserts are denied; `start_chat_conversation` and `send_chat_message` are SECURITY DEFINER and check membership. `chat_inbox(p_view)` returns display names only — never emails. Apply `supabase/migrations/20261031150000_human_messaging_privacy.sql` before relying on the new RPCs.

## Money

Marketplace checkout is WhatsApp with the shop. Package fees (Thabi, Kristen, Sandra) are requested on WhatsApp and activated by an admin. Do not change published prices in code without an explicit business decision.

Guest carts live in `localStorage`. Signed-in customers also save `customer_cart_items` (product id + quantity only). Live prices and stock come from `quote_customer_cart`. Checkout still creates a pending WhatsApp order, not a completed sale. Apply `supabase/migrations/20261031160000_smart_cart.sql` for saved carts and per-line quotes.

## Jobs

Vercel cron (`vercel.json`): hourly loyalty/subscription expire, weekly Stebo. Both require `CRON_SECRET`.
