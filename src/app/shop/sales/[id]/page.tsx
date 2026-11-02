import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";
import { publicDisplayName } from "@/lib/chat-privacy";
import { staffCanManage } from "@/lib/shop/staff";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { shop, staffRole } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: sale } = await supabase.from("sales").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!sale) notFound();
  const [{ data: items }, { data: receipt }] = await Promise.all([
    supabase.from("sale_items").select("id, product_name, quantity, unit_price, total_price").eq("sale_id", id),
    supabase.from("receipts").select("id").eq("sale_id", id).eq("shop_id", shop.id).maybeSingle(),
  ]);

  return (
    <>
      <PageHeader
        title={sale.sale_number || "Sale"}
        subtitle="This record belongs to this shop only."
        action={
          staffCanManage(staffRole) ? (
            <Link href={`/shop/sales/${sale.id}/edit`} className="lg-btn">
              Correct sale
            </Link>
          ) : null
        }
      />
      <section className="lg-card grid gap-2 p-5">
        <p className="flex flex-wrap items-center gap-2">
          <StatusBadge value={sale.status} />
          <span className="text-sm text-[var(--lagecto-muted)]">{formatDateTime(sale.sale_date)}</span>
        </p>
        <p className="text-2xl font-semibold">{money(sale.total)}</p>
        <p className="text-sm">Paid with {paymentMethodLabel(sale.payment_method)}</p>
        <p className="text-sm">Customer: {publicDisplayName(sale.customer_name, "Walk-in")}</p>
        <p className="text-sm">Cashier: {publicDisplayName(sale.cashier_name, "—")}</p>
        {receipt?.id ? (
          <Link href={`/shop/receipts/${receipt.id}`} className="text-sm font-semibold text-[#0B6E4F]">
            Open receipt
          </Link>
        ) : null}
      </section>
      <div className="app-table-wrap mt-4">
        <table className="app-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item) => (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unit_price)}</td>
                <td>{money(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
