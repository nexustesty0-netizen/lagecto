import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { getMarketplaceAnalytics, getTopPerformingShops, TOP_SHOPS_FORMULA } from "@/lib/analytics";
import { money } from "@/lib/format";
import Link from "next/link";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireRole("admin");
  const { period } = await searchParams;
  const selected = period || "month";
  const [stats, top] = await Promise.all([
    getMarketplaceAnalytics({ period: selected }),
    getTopPerformingShops(3, selected),
  ]);
  return (
    <>
      <PageHeader
        title="Platform reports"
        subtitle="Operational marketplace metrics. Shop company sales are not LaGecto revenue."
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {["today", "week", "last_week", "month", "last_month"].map((value) => (
          <Link key={value} href={`/admin/reports?period=${value}`} className={`rounded-full px-4 py-2 text-sm ${selected === value ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}>
            {value.replace("_", " ")}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Orders (count)" value={String(stats?.orders_count || 0)} hint="Not shop GMV" />
        <StatCard label="Package bookings" value={money(stats?.package_bookings_amount || 0)} hint="LaGecto packages sold in period" />
        <StatCard label="Platform POS" value={money(stats?.platform_pos_amount || 0)} hint="LaGecto till only" />
        <StatCard label="Active shops" value={String(stats?.shops_active || 0)} />
        <StatCard label="Users" value={String(stats?.users_total || 0)} hint={`${stats?.users_new || 0} new`} />
        <StatCard label="Engagement events" value={String(stats?.marketplace_events || 0)} />
      </div>
      <p className="mt-6 text-sm text-[var(--lagecto-muted)]">{TOP_SHOPS_FORMULA}</p>
      <ul className="mt-3 grid gap-2 text-sm">
        {top.map((shop, index) => (
          <li key={shop.shop_id}>
            #{index + 1} {shop.shop_name} · activity {Math.round(shop.score)} · {shop.paid_orders} paid orders
          </li>
        ))}
      </ul>
    </>
  );
}
