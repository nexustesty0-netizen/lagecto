import { ClipboardList, CreditCard, Gift, LifeBuoy, Lock, Megaphone, MessageCircle, Newspaper, Sparkles, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { DashboardHero, PeriodChips, StatCard, ActionTile } from "@/components/ui/primitives";
import { ColumnChart } from "@/components/ui/charts";
import { getMarketplaceAnalytics, getRecentSecurityEventCount, getTopPerformingShops } from "@/lib/analytics";
import { TopPerformingShops } from "@/components/admin/TopPerformingShops";
import { money } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import { publicDisplayName } from "@/lib/chat-privacy";
import { registrationGrowth, subscriptionBreakdown } from "@/lib/admin/control-centre";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

const PERIODS: Array<[string, string]> = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["week", "This week"],
  ["last_week", "Last week"],
  ["month", "This month"],
  ["last_month", "Last month"],
];

function GrowthBars({ title, series }: { title: string; series: { label: string; value: number }[] }) {
  return (
    <section className="lg-card p-4">
      <p className="os-kicker">Last 7 days</p>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <div className="mt-4">
        <ColumnChart series={series} label={title} />
      </div>
    </section>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("admin");
  const { period } = await searchParams;
  const selected = period || "week";
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 8 * 86400000).toISOString();
  const [stats, topShops, alerts, ops, loyaltyRes, customersCount, shopsCount, customerGrowth, shopGrowth, subs, recentCustomers, recentShops, recentSupport, openSupport] =
    await Promise.all([
      getMarketplaceAnalytics({ period: selected }),
      getTopPerformingShops(3, selected === "today" ? "week" : selected),
      getRecentSecurityEventCount(7),
      supabase.rpc("platform_ops_stats"),
      supabase.rpc("loyalty_analytics_admin"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "customer"),
      supabase.from("shops").select("id", { count: "exact", head: true }),
      supabase.from("users").select("created_at").eq("role", "customer").gte("created_at", since),
      supabase.from("shops").select("created_at").gte("created_at", since),
      supabase.from("subscriptions").select("shop_id, package_key, plan, status").in("status", ["active", "trial"]),
      supabase.from("users").select("id, name, username, created_at").eq("role", "customer").order("created_at", { ascending: false }).limit(6),
      supabase.from("shops").select("id, name, status, created_at").order("created_at", { ascending: false }).limit(6),
      supabase.from("support_cases").select("id, ticket_number, subject, status, created_at").order("created_at", { ascending: false }).limit(6),
      supabase.from("support_cases").select("id", { count: "exact", head: true }).in("status", ["open", "pending", "new"]),
    ]);
  const opsData = ops.data;
  const loyalty = (loyaltyRes.data || {}) as {
    members?: number;
    badge_unlocks?: number;
    founding_users?: number;
    founding_shops?: number;
  };
  const shopTotal = shopsCount.count || stats?.shops_active || 0;
  const packages = subscriptionBreakdown(shopTotal, subs.data || []);
  const customers = customersCount.count || 0;

  return (
    <div className="admin-console">
      <DashboardHero
        kicker="Super Admin"
        title="LaGecto control centre"
        subtitle="Live marketplace counts only. Shop till totals are not treated as LaGecto revenue."
        image="/visuals/public-hero.png"
      />
      <PeriodChips selected={selected} options={PERIODS} hrefFor={(value) => `/admin?period=${value}`} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard tone="dark" label="Customers" value={String(customers)} hint={`${stats?.users_new || 0} new users this period`} />
        <StatCard tone="green" label="Shops" value={String(shopTotal)} hint={`${stats?.shops_active || 0} active`} />
        <StatCard tone="gold" label="Pending verification" value={String(stats?.pending_verification || 0)} hint={`${stats?.pending_registrations || 0} registrations`} />
        <StatCard label="Listed products" value={String(stats?.products || 0)} hint={`${stats?.services || 0} services`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <StatCard label="Platform activity" value={String(stats?.marketplace_events || 0)} hint="Views and carts this period" />
        <StatCard label="Active packages" value={String(stats?.active_subscriptions || 0)} hint={money(stats?.package_bookings_amount || 0)} />
        <StatCard label="LaGecto POS" value={money(stats?.platform_pos_amount || 0)} hint={`${stats?.platform_pos_count || 0} receipts`} />
        <StatCard label="Shop reports" value={String(opsData?.unread_manager_reports || 0)} hint="Unread notes" />
        <StatCard label="Locked accounts" value={String(stats?.locked_accounts || 0)} hint={`${alerts || 0} security / 7d`} />
        <StatCard label="Loyalty" value={String(loyalty?.members || 0)} hint={`${loyalty?.badge_unlocks || 0} badges`} />
      </div>
      <section className="lg-card mt-4 p-4">
        <p className="os-kicker">Packages</p>
        <h2 className="mt-1 text-lg font-semibold">Subscription distribution</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {Object.entries(packages.counts).map(([key, count]) => (
            <li key={key} className="rounded-full bg-[#F7F3E8] px-3 py-1 text-sm">
              <span className="font-semibold capitalize">{key}</span> · {count}
            </li>
          ))}
          <li className="rounded-full bg-[#F7F3E8] px-3 py-1 text-sm">No active package · {packages.withoutPackage}</li>
        </ul>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <GrowthBars title="Customer growth" series={registrationGrowth(customerGrowth.data || [])} />
        <GrowthBars title="Shop growth" series={registrationGrowth(shopGrowth.data || [])} />
      </div>
      <div className="mt-5 grid gap-3 sm:mt-6 xl:grid-cols-[1.2fr_0.8fr]">
        <TopPerformingShops shops={topShops} />
        <section className="lg-card overflow-hidden p-4 sm:p-5">
          <p className="os-kicker">Needs attention</p>
          <h2 className="mt-1 text-lg font-semibold">Platform alerts</h2>
          <ul className="mt-4 grid gap-2">
            {[
              ["Pending verification", stats?.pending_verification || 0, "/admin/verification"],
              ["Registration requests", stats?.pending_registrations || 0, "/admin/verification?tab=registrations"],
              ["Locked accounts", stats?.locked_accounts || 0, "/admin/security"],
              ["Open support", openSupport.count || 0, "/admin/support"],
              ["Live ads", stats?.live_ads || 0, "/admin/ads"],
            ].map(([label, count, href]) => (
              <li key={String(label)}>
                <Link href={String(href)} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F3E8] px-3 py-2.5 text-sm">
                  <span>{label}</span>
                  <span className="grid min-w-7 place-items-center rounded-full bg-[#0B6E4F] px-2 py-0.5 text-xs font-semibold text-white">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-[var(--lagecto-muted)]">Timezone: Africa/Harare. Same definitions as Reports.</p>
        </section>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <section className="lg-card p-4">
          <p className="os-kicker">People</p>
          <h2 className="mt-1 text-lg font-semibold">Recent customers</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(recentCustomers.data || []).map((row) => (
              <li key={row.id}>
                <Link href={`/admin/customers/${row.id}`} className="flex justify-between gap-3 rounded-xl bg-[#F7F3E8] px-3 py-2">
                  <span className="truncate">{publicDisplayName(row.name || row.username, "Customer")}</span>
                  <span className="shrink-0 text-[var(--lagecto-muted)]">{formatDateTime(row.created_at)}</span>
                </Link>
              </li>
            ))}
            {!recentCustomers.data?.length ? <li className="text-[var(--lagecto-muted)]">No customer registrations yet.</li> : null}
          </ul>
        </section>
        <section className="lg-card p-4">
          <p className="os-kicker">Shops</p>
          <h2 className="mt-1 text-lg font-semibold">Recent shops</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(recentShops.data || []).map((row) => (
              <li key={row.id}>
                <Link href={`/admin/shops/${row.id}`} className="flex justify-between gap-3 rounded-xl bg-[#F7F3E8] px-3 py-2">
                  <span className="truncate">{row.name}</span>
                  <span className="shrink-0 text-[var(--lagecto-muted)]">{row.status}</span>
                </Link>
              </li>
            ))}
            {!recentShops.data?.length ? <li className="text-[var(--lagecto-muted)]">No shops yet.</li> : null}
          </ul>
        </section>
        <section className="lg-card p-4">
          <p className="os-kicker">Support</p>
          <h2 className="mt-1 text-lg font-semibold">Recent conversations</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(recentSupport.data || []).map((row) => (
              <li key={row.id}>
                <Link href={`/admin/support/${row.id}`} className="flex justify-between gap-3 rounded-xl bg-[#F7F3E8] px-3 py-2">
                  <span className="truncate">{row.ticket_number || row.subject || "Ticket"}</span>
                  <span className="shrink-0 text-[var(--lagecto-muted)]">{row.status}</span>
                </Link>
              </li>
            ))}
            {!recentSupport.data?.length ? <li className="text-[var(--lagecto-muted)]">No support tickets yet.</li> : null}
          </ul>
        </section>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-3 lg:grid-cols-4">
        <ActionTile href="/admin/customers" title="Customers" hint="Accounts" icon={<Users size={16} />} />
        <ActionTile href="/admin/shops" title="Shops" hint="Verify and suspend" icon={<ClipboardList size={16} />} />
        <ActionTile href="/admin/payments" title="Payments" hint="Monitor" icon={<CreditCard size={16} />} />
        <ActionTile href="/admin/security" title="Audit logs" hint="Locks and events" icon={<Lock size={16} />} />
        <ActionTile href="/admin/stebo" title="Stebo" hint="Intelligence" icon={<Sparkles size={16} />} />
        <ActionTile href="/admin/subscriptions" title="Packages" hint="Shop plans" icon={<CreditCard size={16} />} />
        <ActionTile href="/admin/news" title="News" hint="Publishing" icon={<Newspaper size={16} />} />
        <ActionTile href="/admin/loyalty" title="Loyalty" hint="Rewards" icon={<Gift size={16} />} />
        <ActionTile href="/admin/chat" title="Messages" hint="Shops" icon={<MessageCircle size={16} />} />
        <ActionTile href="/admin/shop-reports" title="Reports" hint="Owner notes" icon={<ClipboardList size={16} />} />
        <ActionTile href="/admin/support" title="Support" hint="Tickets and FAQs" icon={<LifeBuoy size={16} />} />
        <ActionTile href="/admin/expenses" title="Expenses" hint="Company costs" icon={<Wallet size={16} />} />
        <ActionTile href="/admin/ads" title="Ads" hint="Placements" icon={<Megaphone size={16} />} />
      </div>
    </div>
  );
}
