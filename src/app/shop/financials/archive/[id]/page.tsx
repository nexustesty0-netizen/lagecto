import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/primitives";
import { formatDate, money } from "@/lib/format";
import { ArchiveExports } from "@/components/shop/ArchiveExports";

export default async function ArchiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: period } = await supabase
    .from("financial_periods")
    .select("*")
    .eq("id", id)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (!period || period.is_current) notFound();

  const [{ data: sales }, { data: expenses }] = await Promise.all([
    supabase.from("sales").select("sale_number, customer_name, total, sale_date, payment_method").eq("shop_id", shop.id).eq("period_id", id).order("sale_date"),
    supabase.from("shop_expenses").select("expense_date, category, description, amount, status").eq("shop_id", shop.id).eq("period_id", id).order("expense_date"),
  ]);

  const snapshot = (period.snapshot || {}) as {
    revenue?: number;
    expenses?: number;
    payroll?: number;
    profit?: number;
    result?: string;
    transactions?: number;
    payments?: { visa?: number; mastercard?: number; ecocash?: number; cash?: number };
  };
  const activeExpenses = (expenses || []).filter((row) => (row.status || "active") === "active");

  return (
    <>
      <PageHeader title={period.label} subtitle={`${formatDate(period.started_at)} – ${formatDate(period.ended_at)} · Read-only archive`} />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Revenue" value={money(snapshot.revenue)} />
        <StatCard label="Payroll" value={money(snapshot.payroll)} />
        <StatCard label="Expenses" value={money(snapshot.expenses)} />
        <StatCard label="Result" value={money(snapshot.profit)} hint={snapshot.result || "Archived operating result"} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Cash (POS)"
          value={money(
            (sales || [])
              .filter((row) => row.payment_method === "cash")
              .reduce((sum, row) => sum + Number(row.total || 0), 0) || snapshot.payments?.cash,
          )}
        />
        <StatCard
          label="WhatsApp checkout"
          value={money(
            (sales || [])
              .filter((row) => row.payment_method === "whatsapp")
              .reduce((sum, row) => sum + Number(row.total || 0), 0),
          )}
        />
      </div>
      <ArchiveExports periodLabel={period.label} sales={sales || []} expenses={activeExpenses} />
      <h2 className="mb-3 mt-8 text-lg font-semibold">Sales</h2>
      {!sales?.length ? (
        <EmptyState title="No sales" body="This archived period has no sales." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Sale</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.sale_number}>
                  <td>{sale.sale_number}</td>
                  <td>{sale.customer_name || "—"}</td>
                  <td>{money(sale.total)}</td>
                  <td>{formatDate(sale.sale_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
