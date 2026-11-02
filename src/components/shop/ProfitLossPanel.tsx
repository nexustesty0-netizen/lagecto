import Link from "next/link";
import { money } from "@/lib/format";
import { BarChart, CompareBars, ResultPill } from "@/components/os/OsUi";
import type { ShopDashboardStats } from "@/lib/shop/dashboard-stats";

export function ProfitLossPanel({ stats }: { stats: ShopDashboardStats }) {
  const result = stats.result;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <article className="rounded-[var(--lg-radius)] bg-[#0B6E4F] p-3.5 text-white sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#FFB000] sm:text-xs">Sales</p>
          <p className="mt-2 text-xl font-semibold sm:text-3xl">{money(stats.revenue)}</p>
          <p className="mt-1 text-[11px] text-white/70 sm:text-xs">Completed sales only</p>
        </article>
        <article className="rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-3.5 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)] sm:text-xs">Payroll</p>
          <p className="mt-2 text-xl font-semibold sm:text-3xl">{money(stats.payroll)}</p>
          <p className="mt-1 text-[11px] text-[var(--lagecto-muted)] sm:text-xs">Paid payroll records</p>
        </article>
        <article className="rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-3.5 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)] sm:text-xs">Expenses</p>
          <p className="mt-2 text-xl font-semibold sm:text-3xl">{money(stats.expenses)}</p>
          <p className="mt-1 text-[11px] text-[var(--lagecto-muted)] sm:text-xs">Active operating expenses</p>
        </article>
        <article className="rounded-[var(--lg-radius)] bg-[#E8F4EE] p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)] sm:text-xs">Result</p>
            <ResultPill result={result} />
          </div>
          <p className={`mt-2 text-xl font-semibold sm:text-3xl ${result === "loss" ? "text-[#C2413B]" : "text-[#0B6E4F]"}`}>{money(stats.profit)}</p>
          <p className="mt-1 text-[11px] text-[var(--lagecto-muted)] sm:text-xs">{stats.calculation_label}</p>
        </article>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <section className="rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-4 sm:p-5">
          <p className="os-kicker">Income versus costs</p>
          <div className="mt-4">
            <CompareBars
              left={{ label: "Sales", value: Number(stats.revenue.toFixed(2)) }}
              right={{ label: "Payroll + expenses", value: Number((stats.payroll + stats.expenses).toFixed(2)), tone: "warn" }}
            />
          </div>
        </section>
        <section className="rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-4 sm:p-5">
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
