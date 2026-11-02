import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import Link from "next/link";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/primitives";
import { PosSalesHistory } from "@/components/shop/PosSalesHistory";
import { staffCanManage } from "@/lib/shop/staff";
import { money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; method?: string; scope?: string }>;
}) {
  const { shop, staffRole } = await getOwnedShop();
  if (!shop) return null;
  const { q, from, to, method, scope } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: period } = await supabase.from("financial_periods").select("id").eq("shop_id", shop.id).eq("is_current", true).maybeSingle();
  let query = supabase
    .from("sales")
    .select("id, sale_number, customer_name, total, status, sale_date, payment_method, cashier_name, order_id")
    .eq("shop_id", shop.id)
    .order("sale_date", { ascending: false })
    .limit(200);
  if (scope !== "all") query = query.eq("period_id", period?.id || "00000000-0000-0000-0000-000000000000");
  if (from) query = query.gte("sale_date", `${from}T00:00:00`);
  if (to) query = query.lte("sale_date", `${to}T23:59:59`);
  if (method) query = query.eq("payment_method", method);
  const { data: sales } = await query;
  const needle = String(q || "").trim().toLowerCase();
  const filtered = (sales || []).filter((sale) => {
    if (!needle) return true;
    return `${sale.sale_number || ""} ${sale.customer_name || ""} ${sale.cashier_name || ""}`.toLowerCase().includes(needle);
  });
  const saleIds = filtered.map((sale) => sale.id);
  const { data: receipts } = saleIds.length
    ? await supabase.from("receipts").select("id, sale_id").eq("shop_id", shop.id).in("sale_id", saleIds)
    : { data: [] as { id: string; sale_id: string | null }[] };
  const receiptBySale = new Map((receipts || []).filter((row) => row.sale_id).map((row) => [row.sale_id as string, row.id]));
  const rows = filtered.map((sale) => ({ ...sale, receipt_id: receiptBySale.get(sale.id) || null }));
  const total = rows.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const completed = rows.filter((sale) => sale.status === "completed").length;

  return (
    <>
      <PageHeader
        title="Sales"
        subtitle={scope === "all" ? "Sales for this shop. Cashiers can view, not void or correct." : "Current financial period. Void a mistake to return stock."}
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-5">
        <input name="q" defaultValue={q} placeholder="Search number, customer, cashier" className="rounded-xl border px-3 py-2 sm:col-span-2" />
        <input name="from" type="date" defaultValue={from} className="rounded-xl border px-3 py-2" />
        <input name="to" type="date" defaultValue={to} className="rounded-xl border px-3 py-2" />
        <select name="method" defaultValue={method || ""} className="rounded-xl border px-3 py-2">
          <option value="">Any payment</option>
          <option value="cash">Cash</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="ecocash">EcoCash</option>
        </select>
        <input type="hidden" name="scope" value={scope === "all" ? "all" : "current"} />
        <button className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white sm:col-span-5 sm:w-fit">Filter</button>
      </form>
      <p className="mb-4 text-sm">
        <Link href={scope === "all" ? "/shop/sales" : "/shop/sales?scope=all"} className="font-medium text-[#0B6E4F]">
          {scope === "all" ? "Show current period" : "Show all recorded sales"}
        </Link>
      </p>
      {rows.length ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Matching sales" value={String(rows.length)} />
          <StatCard label="Completed" value={String(completed)} />
          <StatCard label="Total" value={money(total)} hint={method ? paymentMethodLabel(method) : "Filtered rows"} />
        </div>
      ) : null}
      {!rows.length ? (
        <EmptyState
          title="No sales match"
          body="Record a walk-in sale at Point of sale, or complete an order. Totals for this shop stay on this shop only."
          action={
            <Link href="/shop/pos" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              Open point of sale
            </Link>
          }
        />
      ) : (
        <PosSalesHistory sales={rows} showAllLink={false} canManage={staffCanManage(staffRole)} />
      )}
    </>
  );
}
