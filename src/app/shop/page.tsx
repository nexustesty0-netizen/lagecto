import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { getShopDashboardStats, type DashboardPeriod } from "@/lib/shop/dashboard-stats";
import { PageHeader, StatCard, EmptyState, ActionTile } from "@/components/ui/primitives";
import { ShopStatusCard } from "@/components/shop/ShopStatusCard";
import { ProfitLossPanel } from "@/components/shop/ProfitLossPanel";
import { money, formatDateTime } from "@/lib/format";

export default async function ShopDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { shop, subscription, features } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const { period, from, to } = await searchParams;
  const selected = (period as DashboardPeriod) || "current";
  const stats = await getShopDashboardStats(shop.id, {
    period: selected,
    from,
    to,
  });
  const supabase = await createServerSupabase();
  const [{ data: recentSales }, { data: recentNotes }, { data: chats }, { data: loyalty }] = await Promise.all([
    supabase.from("sales").select("id, total, sale_date, sale_number").eq("shop_id", shop.id).eq("status", "completed").order("sale_date", { ascending: false }).limit(5),
    supabase.from("shop_notifications").select("id, title, created_at").eq("shop_id", shop.id).eq("is_read", false).order("created_at", { ascending: false }).limit(5),
    supabase.from("chat_conversations").select("id").eq("shop_id", shop.id),
    supabase.rpc("loyalty_analytics_shop", { p_shop_id: shop.id }),
  ]);

  return (
    <>
      <PageHeader title={shop.name} subtitle="A live operating view of this shop — every figure comes from recorded activity." />
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ShopStatusCard subscription={subscription} />
        <article className="os-surface">
          <p className="os-kicker">Shop profile</p>
          <p className="mt-2 font-semibold">{shop.name}</p>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{shop.address || "Add an address in Settings"}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-[#0B6E4F]">
            <Link href="/shop/settings">Edit profile</Link>
            <Link href="/shop/storefront">Storefront</Link>
            <Link href="/shop/chat">Messages</Link>
          </div>
        </article>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          ["current", "Current period"],
          ["today", "Today"],
          ["yesterday", "Yesterday"],
          ["week", "This week"],
          ["last_week", "Last week"],
          ["month", "This month"],
          ["last_month", "Last month"],
          ["year", "This year"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value === "current" ? "/shop" : `/shop?period=${value}`}
            className={`rounded-full px-4 py-2 text-sm ${selected === value ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {!stats ? (
        <EmptyState title="No financial period" body="A period is created automatically when the shop is created." />
      ) : (
        <>
          <ProfitLossPanel stats={stats} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Orders pending" value={String(stats.pending_orders)} />
            <StatCard label="Orders completed" value={String(stats.completed_orders)} />
            <StatCard label="Low stock" value={String(stats.low_stock)} hint={`${stats.inventory_units} units on hand`} />
            <StatCard label="Employees" value={String(stats.employee_count)} />
            <StatCard label="Customers" value={String(stats.customers)} />
            <StatCard label="Unread alerts" value={String(recentNotes?.length || 0)} />
            <StatCard label="Conversations" value={String(chats?.length || 0)} />
            <StatCard label="Refunds" value={String(stats.completed_refunds)} hint={money(stats.refunded_volume)} />
            <StatCard label="Loyal customers" value={String(loyalty?.loyal_customers || 0)} hint={`${loyalty?.rewards_redeemed || 0} rewards redeemed`} />
          </div>
        </>
      )}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="os-surface">
          <p className="os-kicker">Recent sales</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {(recentSales || []).map((sale) => (
              <li key={sale.id} className="flex justify-between gap-3">
                <span>{sale.sale_number || "Sale"}</span>
                <span>
                  {money(sale.total)} · {formatDateTime(sale.sale_date)}
                </span>
              </li>
            ))}
            {!recentSales?.length ? <li className="text-[var(--lagecto-muted)]">No completed sales in view.</li> : null}
          </ul>
        </section>
        <section className="os-surface">
          <p className="os-kicker">Quick actions</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ActionTile href="/shop/pos" title="Open POS" hint={features.has("pos") ? "Ready" : "Locked"} />
            <ActionTile href="/shop/quotations" title="Quotations" hint="Estimates and proposals" />
            <ActionTile href="/shop/employees" title="People" hint={features.has("employees") ? `${stats?.employee_count || 0} active` : "Kristen"} />
            <ActionTile href="/shop/inventory" title="Inventory" hint={stats?.low_stock ? `${stats.low_stock} need attention` : "Stock"} />
            <ActionTile href="/shop/reports" title="Report to admin" hint="Operational notes" />
            <ActionTile href="/shop/help" title="Help & Support" hint="FAQs, bugs, technical issues" />
          </div>
        </section>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionTile href="/shop/orders" title="Manage orders" hint="Confirm cash and complete" />
        <ActionTile href="/shop/expenses" title="Expenses" hint={subscription.verified ? "This period" : "Kristen"} />
        <ActionTile href="/shop/promotions" title="Promotions" hint="Included on Free" />
        <ActionTile href="/shop/loyalty" title="Customer loyalty" hint="Shop-only rewards" />
        <ActionTile href="/shop/help" title="Help & Support" hint="Storefront, POS, payroll, WhatsApp checkout" />
        <ActionTile href="/shop/subscription" title="Subscription" hint={subscription.verified ? "Verified shop" : "Upgrade for a verified badge"} />
      </div>
    </>
  );
}
