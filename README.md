# LaGecto Web

A Next.js website that functions as a full LaGecto web application. It is a companion to the existing mobile app, not a replacement. It uses a **separate Supabase project**.

## 1. What exists in the original LaGecto app

The original project is an Expo/React Native app (`LaGectoAdmin`) with three roles:

- **Customer** — shops, cart, orders, receipts, reviews, notifications, profile, Smart Diary, loyalty/badges, Stebo AI companion
- **Shop owner** — dashboard, products/services, inventory, POS, orders, customers, sales, expenses, payroll, reports, receipts, promotions, storefront, verification, settings
- **Admin** — users, shops, Shop IDs, verification, subscriptions, broadcasts, security unlock, Stebo knowledge tools

Authentication is handled by an auth gateway: customers/admins sign in with email or username; shop owners sign in with a generated Shop ID such as `gectotech@lg23`. Security includes unique usernames, a 14-day username change lock, lockout after 5 failed logins, RLS, and audit logs.

## 2. Feature inventory (web)

### CUSTOMER
Dashboard, shops, saved shops, Smart Shopping, cart, checkout, orders, receipts, reviews, bookings, service requests, chat, community, news, loyalty, badges, full Smart Diary, Stebo Personal, notifications, settings

### SHOP OWNER
Dashboard, products, services, categories, inventory, POS, orders, bookings, service requests, customers, employees, payroll, suppliers, purchases, sales, expenses, financials (current + archives), receipts, storefront, promotions, community, insights, subscription, verification, chat, news, Smart Diary, Stebo Business, settings, help

Kristen-gated modules (POS, inventory, employees, payroll, chat, advanced diary, insights) are checked on the server, not only hidden in the nav.

### ADMIN
Manage users (roles, Super Admin/Staff/Clerk, promote shop owner, assign staff), shops (edit, activate/suspend, assign package), verification, orders, Thabi/Kristen package CRUD, security unlock, reports, news CMS, company profile, languages, broadcasts, Smart Diary, Stebo Intelligence Center

### SHARED / AUTHENTICATION / SETTINGS / SECURITY
Login, signup, password reset, logout, role-based route protection, username change (14 days), lockout, RLS, audit log. Role and plan assignment only via admin RPCs and `/api/admin/*`.

### FINANCIAL / ORDERS / SHOPS / PRODUCTS / RECEIPTS / SUPPORT
Current period, archived periods (view/search/export PDF & Excel), POS and order receipts, Help & Support using official contact details

### PUBLIC
Marketplace, shops, news, subscription plans (Thabi/Kristen), marketing pages, support

## 3. Web architecture

- Next.js 16 App Router, TypeScript, Tailwind CSS v4
- Public marketing site + authenticated application
- Cookie sessions via `@supabase/ssr`
- Auth gateway in Next.js Route Handlers (service role stays on the server)
- Database RPCs for checkout, POS, financial archive, username change, unlock, role/plan assignment
- `src/proxy.ts` for session refresh and unauthenticated redirects
- Stebo via `POST /api/stebo/chat` (knowledge retrieval, optional `STEBO_API_URL`)

## 4. Routes

Public: `/` `/marketplace` `/shops` `/news` `/plans` `/about` `/how-it-works` `/features` `/for-customers` `/for-shops` `/help` `/contact` `/register-shop`  
Auth: `/login` `/signup` `/forgot-password` `/app`  
Customer: `/customer` `/customer/shops` `/customer/saved` `/customer/smart-shop` `/customer/cart` `/customer/orders` `/customer/receipts` `/customer/bookings` `/customer/requests` `/customer/chat` `/customer/community` `/customer/news` `/customer/loyalty` `/customer/badges` `/customer/diary` `/customer/stebo` `/customer/notifications` `/customer/settings`  
Shop: `/shop` `/shop/products` `/shop/services` `/shop/categories` `/shop/inventory` `/shop/pos` `/shop/orders` `/shop/bookings` `/shop/service-requests` `/shop/customers` `/shop/employees` `/shop/payroll` `/shop/suppliers` `/shop/purchases` `/shop/financials` `/shop/receipts` `/shop/storefront` `/shop/promotions` `/shop/community` `/shop/insights` `/shop/subscription` `/shop/verification` `/shop/chat` `/shop/news` `/shop/diary` `/shop/stebo` `/shop/settings` `/shop/help`  
Admin: `/admin` `/admin/users` `/admin/shops` `/admin/verification` `/admin/orders` `/admin/subscriptions` `/admin/security` `/admin/news` `/admin/company` `/admin/languages` `/admin/notifications` `/admin/reports` `/admin/diary` `/admin/stebo` `/admin/settings`

## 5. Environment variables

Copy `.env.example` to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
STEBO_API_URL=
```

Never put the service role key in client code or source control. `STEBO_API_URL` is optional; without it Stebo answers from knowledge and training examples.

## 6. Connect the NEW Supabase project

1. Create a new Supabase project (do not reuse the mobile app project).
2. In the SQL editor, run the files in `supabase/migrations/` in filename order.
3. Enable Email auth. Confirm email can be on or off depending on your process.
4. Copy the project URL, anon key, and service role key into `.env.local`.
5. Create the first admin in Auth, then set `public.users.role = 'admin'` in the SQL editor. Later role changes go through Manage Users (admin RPCs). Users cannot promote themselves.

## 7. Run locally

```bash
cd lagecto-web
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000

## 8. Production build

```bash
npm run build
npm start
```

## 9. Deploy

Deploy to Vercel (or any Next.js host). Set the same environment variables. Set `NEXT_PUBLIC_SITE_URL` to the public domain. Apply the SQL migrations to the new Supabase project before first login.

## 10. Support

LaGecto Support  
Phone: +263 71 503 4314  
Email: lagecto@outlook.com

## 11. Features that still need configuration

- New Supabase project URL/keys
- Running the SQL migrations (including `20260908040000_lagecto_web_parity.sql`)
- Creating the first admin in the database
- Auth email templates / custom SMTP (optional)
- Storage buckets if you later add image uploads
- Optional `STEBO_API_URL` if you want the Python Stebo backend instead of retrieval-only replies
- Seed extra Stebo knowledge in the Intelligence Center
