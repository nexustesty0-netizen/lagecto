import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { CompleteOrderButton } from "@/components/shop/CompleteOrderButton";
import { paymentMethodLabel } from "@/lib/payments/methods";

export default async function ShopOrdersPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const [{ data: orders }, { data: receipts }] = await Promise.all([
    supabase.from("orders").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    supabase.from("receipts").select("id, order_id, receipt_number").eq("shop_id", shop.id).not("order_id", "is", null),
  ]);
  const receiptByOrder = new Map((receipts || []).map((row) => [row.order_id, row]));

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Marketplace orders stay pending until you confirm them with the customer on WhatsApp. Complete generates a shop receipt."
      />
      {!orders?.length ? (
        <EmptyState title="No orders" body="Customer checkouts will appear here." />
      ) : (
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Order</th>
                <th>Payment</th>
                <th>Placed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number}</td>
                  <td>{order.customer_name}</td>
                  <td>{money(order.total)}</td>
                  <td>
                    <StatusBadge value={order.status} />
                  </td>
                  <td>
                    <StatusBadge
                      value={
                        order.payment_method === "whatsapp"
                          ? "pending with shop"
                          : order.payment_status || "pending"
                      }
                    />
                    <p className="mt-1 text-xs text-[#6B7280]">{paymentMethodLabel(order.payment_method)}</p>
                  </td>
                  <td>{formatDateTime(order.created_at)}</td>
                  <td>
                    {order.status !== "completed" && order.status !== "cancelled" && order.status !== "refunded" ? (
                      <CompleteOrderButton orderId={order.id} />
                    ) : receiptByOrder.get(order.id) ? (
                      <Link href={`/shop/receipts/${receiptByOrder.get(order.id)?.id}`} className="text-sm text-[#0B6E4F]">
                        View receipt
                      </Link>
                    ) : order.status === "completed" ? (
                      <CompleteOrderButton orderId={order.id} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
