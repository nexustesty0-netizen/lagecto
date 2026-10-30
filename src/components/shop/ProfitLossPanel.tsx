import Link from "next/link";
import { money } from "@/lib/format";
import { BarChart, CompareBars, ResultPill } from "@/components/os/OsUi";
import type { ShopDashboardStats } from "@/lib/shop/dashboard-stats";

export function ProfitLossPanel({ stats }: { stats: ShopDashboardStats }) {
  const result = stats.result;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="os-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Sales</p>
          <p className="mt-2 text-3xl font-semibold">{money(stats.revenue)}</p>
          <p className="mt-1 text-xs text-[var(--lagecto-muted)]">Completed sales only</p>
        </article>
        <article className="os-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Payroll</p>
          <p className="mt-2 text-3xl font-semibold">{money(stats.payroll)}</p>
          <p className="mt-1 text-xs text-[var(--lagecto-muted)]">Paid payroll records</p>
        </article>
        <article className="os-surface">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Expenses</p>
          <p className="mt-2 text-3xl font-semibold">{money(stats.expenses)}</p>
          <p className="mt-1 text-xs text-[var(--lagecto-muted)]">Active operating expenses</p>
        </article>
        <article className="os-surface">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Result</p>
            <ResultPill result={result} />
          </div>
          <p className={`mt-2 text-3xl font-semibold ${result === "loss" ? "text-[#C2413B]" : "text-[#0B6E4F]"}`}>{money(stats.profit)}</p>
          <p className="mt-1 text-xs text-[var(--lagecto-muted)]">{stats.calculation_label}</p>
        </article>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="os-surface">
          <p className="os-kicker">Income versus costs</p>
          <div className="mt-4">
            <CompareBars
              left={{ label: "Sales", value: Number(stats.revenue.toFixed(2)) }}
              right={{ label: "Payroll + expenses", value: Number((stats.payroll + stats.expenses).toFixed(2)), tone: "warn" }}
            />
          </div>
        </section>
        <section className="os-surface">
          <p className="os-kicker">Expense categories</p>
          <div className="mt-4">
            <BarChart
              items={stats.expense_categories.map((item) => ({ label: item.category, value: Number(item.amount) }))}
              empty="No operating expenses in this period."
            />
          </div>
        </section>
      </div>
      {stats.cogs > 0 ? (
        <p className="text-sm text-[var(--lagecto-muted)]">
          Recorded product cost in this view: {money(stats.cogs)}. That figure is shown for information and is not subtracted from operating profit, so archived periods stay comparable.
        </p>
      ) : (
        <p className="text-sm text-[var(--lagecto-muted)]">
          This is a simplified operating profit: completed sales minus operating expenses minus paid payroll. Cost of goods is not subtracted unless you record product cost.
        </p>
      )}
      <div className="flex flex-wrap gap-3 text-sm font-semibold text-[#0B6E4F]">
        <Link href="/shop/expenses">Expenses</Link>
        <Link href="/shop/payroll">Payroll</Link>
        <Link href="/shop/financials/archive">Archives</Link>
      </div>
    </div>
  );
}
