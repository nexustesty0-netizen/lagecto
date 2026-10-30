import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, getCurrentPeriod, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { ExpenseBoard } from "@/components/shop/ExpenseBoard";
import { getShopDashboardStats } from "@/lib/shop/dashboard-stats";
import { money } from "@/lib/format";

export default async function ExpensesPage() {
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "expenses");
  if (locked) return <FeatureLocked feature="expenses" reason={locked} />;
  const supabase = await createServerSupabase();
  const period = await getCurrentPeriod(shop.id);
  const stats = await getShopDashboardStats(shop.id, { period: "current" });
  const { data: expenses } = await supabase
    .from("shop_expenses")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("period_id", period?.id || "00000000-0000-0000-0000-000000000000")
    .order("expense_date", { ascending: false });

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle={`Recorded against ${period?.label || "the current period"}. Delete one row or clear all to start this period from zero. Voided items stay in history but leave profit and loss.`}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Operating expenses</p>
          <p className="mt-2 text-2xl font-semibold">{money(stats?.expenses || 0)}</p>
        </article>
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Paid payroll</p>
          <p className="mt-2 text-2xl font-semibold">{money(stats?.payroll || 0)}</p>
          <p className="mt-1 text-xs text-[var(--lagecto-muted)]">Tracked in Payroll, not mixed into these rows.</p>
        </article>
      </div>
      {period ? <ExpenseBoard expenses={expenses || []} /> : <EmptyState title="No financial period" body="A period is created when the shop is created." />}
    </>
  );
}
