import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { ExpenseBoard } from "@/components/shop/ExpenseBoard";
import { PLATFORM_EXPENSE_CATEGORIES } from "@/lib/features";
import { money } from "@/lib/format";

export default async function AdminExpensesPage() {
  await requireAdminLevel("admin");
  const supabase = await createServerSupabase();
  const [{ data: expenses }, { data: ops }] = await Promise.all([
    supabase.from("platform_expenses").select("*").order("expense_date", { ascending: false }).limit(200),
    supabase.rpc("platform_ops_stats"),
  ]);
  return (
    <>
      <PageHeader
        title="LaGecto expenses"
        subtitle="Company operating costs only. Shop sales and shop expenses are never included here."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">LaGecto till</p>
          <p className="mt-2 text-2xl font-semibold">{money(ops?.platform_pos_amount || 0)}</p>
        </article>
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Operating expenses</p>
          <p className="mt-2 text-2xl font-semibold">{money(ops?.platform_expenses || 0)}</p>
        </article>
        <article className="os-surface">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Operating result</p>
          <p className="mt-2 text-2xl font-semibold">{money(ops?.platform_operating_result || 0)}</p>
        </article>
      </div>
      <p className="mb-4 text-sm text-[var(--lagecto-muted)]">{ops?.note || "Shop company sales are not LaGecto revenue."}</p>
      {!expenses ? (
        <EmptyState title="No expenses" body="Add hosting, support, and other LaGecto costs." />
      ) : (
        <ExpenseBoard
          expenses={expenses}
          endpoint="/api/admin/expenses"
          categories={[...PLATFORM_EXPENSE_CATEGORIES]}
          clearTitle="Clear all LaGecto expenses?"
          clearBody="This permanently deletes every platform operating expense so you can start from zero. Shop expenses are not affected."
        />
      )}
    </>
  );
}
