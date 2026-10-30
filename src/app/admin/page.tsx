import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatCard, ActionTile } from "@/components/ui/primitives";
import { getMarketplaceAnalytics, getRecentSecurityEventCount, getTopPerformingShops } from "@/lib/analytics";
import { TopPerformingShops } from "@/components/admin/TopPerformingShops";
import { money } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("admin");
  const { period } = await searchParams;
  const selected = period || "week";
  const supabase = await createServerSupabase();
  const [stats, topShops, alerts, ops, loyaltyRes] = await Promise.all([
    getMarketplaceAnalytics({ period: selected }),
    getTopPerformingShops(3, selected === "today" ? "week" : selected),
    getRecentSecurityEventCount(7),
    supabase.rpc("platform_ops_stats"),
    supabase.rpc("loyalty_analytics_admin"),
  ]);
  const opsData = ops.data;
  const loyalty = (loyaltyRes.data || {}) as {
    members?: number;
    badge_unlocks?: number;
    founding_users?: number;
    founding_shops?: number;
  };

  return (
    <div className="admin-console">
      <PageHeader
        title="Command center"
        subtitle="Platform operations for LaGecto Marketplace. Shop company sales are never counted as LaGecto revenue."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["today", "Today"],
          ["yesterday", "Yesterday"],
          ["week", "This week"],
          ["last_week", "Last week"],
          ["month", "This month"],
          ["last_month", "Last month"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/admin?period=${value}`}
            className={`rounded-full px-4 py-2 text-sm ${selected === value ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered users" value={String(stats?.users_total || 0)} hint={`${stats?.users_new || 0} new in period`} />
        <StatCard label="Active shops" value={String(stats?.shops_active || 0)} hint={`${stats?.shops_verified || 0} verified`} />
        <StatCard label="Marketplace orders" value={String(stats?.orders_count || 0)} hint="Count only — not shop GMV" />
        <StatCard label="Listings" value={String((stats?.products || 0) + (stats?.services || 0))} hint={`${stats?.products || 0} products · ${stats?.services || 0} services`} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Marketplace events" value={String(stats?.marketplace_events || 0)} hint="Views, search, cart activity" />
        <StatCard label="Active subscriptions" value={String(stats?.active_subscriptions || 0)} hint={`Package bookings ${money(stats?.package_bookings_amount || 0)}`} />
        <StatCard label="LaGecto POS" value={money(stats?.platform_pos_amount || 0)} hint={`${stats?.platform_pos_count || 0} platform receipts`} />
        <StatCard label="Unread shop reports" value={String(opsData?.unread_manager_reports || 0)} hint="Owner notes, not shop GMV" />
        <StatCard label="Platform health" value={String(stats?.locked_accounts || 0)} hint={`${stats?.pending_verification || 0} verification · ${alerts || 0} security events / 7d`} />
        <StatCard label="Loyalty members" value={String(loyalty?.members || 0)} hint={`${loyalty?.badge_unlocks || 0} badge unlocks`} />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <TopPerformingShops shops={topShops} />
        <section className="lg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">Alerts</p>
          <h2 className="mt-1 text-lg font-semibold">Needs attention</h2>
          <ul className="mt-4 grid gap-2 text-sm">
            <li>Pending shop verification: {stats?.pending_verification || 0}</li>
            <li>Registration requests: {stats?.pending_registrations || 0}</li>
            <li>Locked accounts: {stats?.locked_accounts || 0}</li>
            <li>Live ads: {stats?.live_ads || 0} · Promotions: {stats?.active_promotions || 0}</li>
            <li>Founding users: {loyalty?.founding_users || 0} · founding shops {loyalty?.founding_shops || 0}</li>
          </ul>
          <p className="mt-4 text-xs text-[var(--lagecto-muted)]">Timezone: Africa/Harare. Same definitions as Reports and Stebo.</p>
        </section>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionTile href="/admin/users" title="Manage users" hint="Roles, unlocks, shop assignment" />
        <ActionTile href="/admin/payments" title="Payments" hint="Monitor transactions" />
        <ActionTile href="/admin/security" title="Security" hint="Locks and audit events" />
        <ActionTile href="/admin/stebo" title="Stebo Intelligence" hint="Platform assistant + weekly reports" />
        <ActionTile href="/admin/subscriptions" title="Packages" hint="Shop plans" />
        <ActionTile href="/admin/news" title="News" hint="Editorial publishing" />
        <ActionTile href="/admin/loyalty" title="Customer loyalty" hint="Platform rewards and badges" />
        <ActionTile href="/admin/chat" title="Messages" hint="Shops and announcements" />
        <ActionTile href="/admin/shop-reports" title="Shop reports" hint="Owner notes to admin" />
        <ActionTile href="/admin/support" title="Support Centre" hint="Tickets, bugs, shop safety, FAQs" />
        <ActionTile href="/admin/expenses" title="LaGecto expenses" hint="Company costs only" />
        <ActionTile href="/admin/ads" title="Ads" hint="Banners and featured placements" />
      </div>
    </div>
  );
}
