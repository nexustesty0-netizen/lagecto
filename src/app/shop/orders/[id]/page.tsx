import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { CompleteOrderButton } from "@/components/shop/CompleteOrderButton";
import { formatDateTime, money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";

type OrderItem = { name?: string; quantity?: number; price?: number; line_total?: number; product_name?: string };

export default async function ShopOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_email, customer_phone, total, status, payment_status, payment_method, items, notes, created_at")
    .eq("id", id)
    .eq("shop_id", shop.id)
    .maybeSingle();
  if (!order) notFound();
  const { data: receipts } = await supabase.from("receipts").select("id, receipt_number").eq("order_id", order.id).eq("shop_id", shop.id);
  const lines = (Array.isArray(order.items) ? order.items : []).map((item: OrderItem, index: number) => ({
    key: `${item.name || item.product_name || "Item"}-${index}`,
    name: String(item.name || item.product_name || "Item"),
    quantity: Number(item.quantity || 1),
    lineTotal: Number(item.line_total ?? Number(item.price || 0) * Number(item.quantity || 1)),
  }));

  return (
    <>
      <PageHeader
        title={order.order_number}
        subtitle={order.customer_name || "Customer"}
        action={
          <Link href="/shop/orders" className="text-sm font-medium text-[#0B6E4F]">
            All orders
          </Link>
        }
      />
      <article className="rounded-2xl bg-white p-5">
        <p className="flex justify-between text-sm">
          <span>Total</span>
          <span>{money(order.total)}</span>
        </p>
        <p className="mt-2 flex justify-between text-sm">
          <span>Order</span>
          <StatusBadge value={order.status} />
        </p>
        <p className="mt-2 flex justify-between text-sm">
          <span>Payment</span>
          <StatusBadge value={order.payment_method === "whatsapp" ? "pending with shop" : order.payment_status || "pending"} />
        </p>
        <p className="mt-2 text-sm text-[#6B7280]">{paymentMethodLabel(order.payment_method)}</p>
        {order.customer_phone ? <p className="mt-2 text-sm">{order.customer_phone}</p> : null}
        {order.customer_email ? <p className="text-sm text-[#6B7280]">{order.customer_email}</p> : null}
        <p className="mt-2 text-sm text-[#6B7280]">{formatDateTime(order.created_at)}</p>
        {order.notes ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{order.notes}</p> : null}
        <div className="mt-4">
          {order.status !== "completed" && order.status !== "cancelled" && order.status !== "refunded" ? (
            <CompleteOrderButton orderId={order.id} />
          ) : receipts?.[0] ? (
            <Link href={`/shop/receipts/${receipts[0].id}`} className="text-sm font-semibold text-[#0B6E4F]">
              View receipt
            </Link>
          ) : null}
        </div>
      </article>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Items</h2>
      <div className="grid gap-2">
        {lines.map((line) => (
          <article key={line.key} className="rounded-2xl bg-white p-4 text-sm">
            <p className="font-semibold">
              {line.name} × {line.quantity}
            </p>
            <p className="text-[#6B7280]">{money(line.lineTotal)}</p>
          </article>
        ))}
      </div>
    </>
  );
}
