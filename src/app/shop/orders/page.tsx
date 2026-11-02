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
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, total, status, payment_status, payment_method, created_at")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(80);
  const orderIds = (orders || []).map((order) => order.id);
  const { data: receipts } = orderIds.length
    ? await supabase.from("receipts").select("id, order_id, receipt_number").eq("shop_id", shop.id).in("order_id", orderIds)
    : { data: [] as { id: string; order_id: string | null; receipt_number?: string }[] };
  const receiptByOrder = new Map((receipts || []).map((row) => [row.order_id, row]));

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Marketplace checkouts stay pending until you confirm them with the customer on WhatsApp. There is no separate pre-order module. Complete generates a shop receipt."
      />
      {!orders?.length ? (
        <EmptyState title="No orders" body="Customer checkouts will appear here." />
      ) : (
        <>
        <div className="grid gap-2 md:hidden">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-[var(--lagecto-border)] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{order.order_number}</p>
                  <p className="text-xs text-[var(--lagecto-muted)]">{order.customer_name}</p>
                </div>
                <p className="text-sm font-semibold text-[#0B6E4F]">{money(order.total)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge value={order.status} />
                <span className="text-xs text-[var(--lagecto-muted)]">{formatDateTime(order.created_at)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={`/shop/orders/${order.id}`} className="text-sm font-semibold text-[#0B6E4F]">
                  View order
                </Link>
                {order.status !== "completed" && order.status !== "cancelled" && order.status !== "refunded" ? (
                  <CompleteOrderButton orderId={order.id} />
                ) : receiptByOrder.get(order.id) ? (
                  <Link href={`/shop/receipts/${receiptByOrder.get(order.id)?.id}`} className="text-sm font-semibold text-[#0B6E4F]">
                    View receipt
                  </Link>
                ) : order.status === "completed" ? (
                  <CompleteOrderButton orderId={order.id} />
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <div className="app-table-wrap hidden md:block">
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
                    <Link href={`/shop/orders/${order.id}`} className="mr-3 text-sm font-semibold text-[#0B6E4F]">
                      View
                    </Link>
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
        </>
      )}
    </>
  );
}
