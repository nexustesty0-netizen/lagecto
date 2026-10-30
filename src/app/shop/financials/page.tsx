import { getOwnedShop } from "@/lib/auth/session";
import { getShopDashboardStats } from "@/lib/shop/dashboard-stats";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { money, formatDate } from "@/lib/format";
import { StartPeriodButton } from "@/components/shop/StartPeriodButton";
import { ProfitLossPanel } from "@/components/shop/ProfitLossPanel";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";

export default async function FinancialsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("is_current", true)
    .maybeSingle();
  const stats = await getShopDashboardStats(shop.id, { period: "current" });
  const periodId = current?.id;
  const { data: sales } = periodId
    ? await supabase.from("sales").select("total, payment_method").eq("shop_id", shop.id).eq("period_id", periodId)
    : { data: [] as { total: number; payment_method: string | null }[] };
  const byMethod = (method: string) =>
    (sales || []).filter((row) => row.payment_method === method).reduce((sum, row) => sum + Number(row.total || 0), 0);

  return (
    <>
      <PageHeader
        title="Financials"
        subtitle="Start a new period to archive the current one. Historical records stay read-only and are never mixed into the live period."
        action={<StartPeriodButton />}
      />
      <div className="mb-6 os-surface">
        <p className="text-sm text-[var(--lagecto-muted)]">Current period</p>
        <h2 className="text-2xl font-semibold">{current?.label || "—"}</h2>
        <p className="text-sm text-[var(--lagecto-muted)]">Started {formatDate(current?.started_at)}</p>
      </div>
      {stats ? <ProfitLossPanel stats={stats} /> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Net paid" value={money(stats?.net_paid || 0)} hint="Paid volume minus completed refunds" />
        <StatCard label="Refunded" value={money(stats?.refunded_volume || 0)} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Cash (POS)" value={money(byMethod("cash"))} hint="In-person till sales" />
        <StatCard
          label="WhatsApp checkout"
          value={money(byMethod("whatsapp"))}
          hint="Marketplace orders arranged with the customer"
        />
      </div>
      <Link href="/shop/financials/archive" className="mt-6 inline-block rounded-full border px-4 py-2">
        View archived periods
      </Link>
    </>
  );
}
