import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { PosSalesHistory } from "@/components/shop/PosSalesHistory";

export default async function SalesPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: period } = await supabase.from("financial_periods").select("id").eq("shop_id", shop.id).eq("is_current", true).maybeSingle();
  const [{ data: sales }, { data: receipts }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_number, customer_name, total, status, sale_date, payment_method, cashier_name, order_id")
      .eq("shop_id", shop.id)
      .eq("period_id", period?.id || "00000000-0000-0000-0000-000000000000")
      .order("sale_date", { ascending: false }),
    supabase.from("receipts").select("id, sale_id").eq("shop_id", shop.id),
  ]);
  const receiptBySale = new Map((receipts || []).filter((row) => row.sale_id).map((row) => [row.sale_id as string, row.id]));
  const rows = (sales || []).map((sale) => ({ ...sale, receipt_id: receiptBySale.get(sale.id) || null }));

  return (
    <>
      <PageHeader title="Sales" subtitle="Current financial period. Delete a mistake or clear all sales to start the till from zero — stock is returned." />
      {!rows.length ? (
        <EmptyState title="No sales in this period" body="POS sales and completed orders will appear here." />
      ) : (
        <PosSalesHistory sales={rows} showAllLink={false} />
      )}
    </>
  );
}
