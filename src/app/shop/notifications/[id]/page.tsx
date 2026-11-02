import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { NotificationRead } from "@/components/notifications/NotificationRead";
import { CompleteOrderButton } from "@/components/shop/CompleteOrderButton";
import { StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { noticeKind, notificationRelatedHref, orderNumberFromNotice, staffMaySeeNotice } from "@/lib/notifications";
import { paymentMethodLabel } from "@/lib/payments/methods";

type OrderItem = { name?: string; quantity?: number; price?: number; line_total?: number; product_name?: string };

function orderLines(items: unknown) {
  return (Array.isArray(items) ? items : []).map((item: OrderItem, index) => ({
    key: `${item.name || item.product_name || "Item"}-${index}`,
    name: String(item.name || item.product_name || "Item"),
    quantity: Number(item.quantity || 1),
    lineTotal: Number(item.line_total ?? Number(item.price || 0) * Number(item.quantity || 1)),
  }));
}

export default async function ShopNotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop, staffRole } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: item } = await supabase.from("shop_notifications").select("*").eq("shop_id", shop.id).eq("id", id).maybeSingle();
  if (!item || !staffMaySeeNotice(staffRole, item.type)) notFound();
  if (!item.is_read) {
    await supabase.from("shop_notifications").update({ is_read: true }).eq("id", item.id).eq("shop_id", shop.id);
  }

  const kind = noticeKind(item.type);
  const relatedHref = notificationRelatedHref(item, "shop");
  let order: {
    id: string;
    order_number: string;
    customer_name: string | null;
    customer_phone: string | null;
    total: number;
    status: string;
    payment_method: string | null;
    payment_status?: string | null;
    items: unknown;
    created_at: string;
  } | null = null;
  let enquiry: { id: string; title: string; details: string | null; customer_name: string | null; status: string; created_at: string } | null = null;

  if (kind === "order") {
    if (item.reference_id) {
      const { data } = await supabase.from("orders").select("id, order_number, customer_name, customer_phone, total, status, payment_method, payment_status, items, created_at").eq("shop_id", shop.id).eq("id", item.reference_id).maybeSingle();
      order = data;
    }
    const orderNo = orderNumberFromNotice(item.message);
    if (!order && orderNo) {
      const { data } = await supabase.from("orders").select("id, order_number, customer_name, customer_phone, total, status, payment_method, payment_status, items, created_at").eq("shop_id", shop.id).eq("order_number", orderNo).maybeSingle();
      order = data;
    }
  }
  if ((kind === "enquiry" || kind === "request") && item.reference_id) {
    const { data } = await supabase.from("service_requests").select("id, title, details, customer_name, status, created_at").eq("shop_id", shop.id).eq("id", item.reference_id).maybeSingle();
    enquiry = data;
  }

  const openHref = order ? `/shop/orders/${order.id}` : enquiry ? `/shop/service-requests/${enquiry.id}` : relatedHref;

  return (
    <NotificationRead item={item} backHref="/shop/notifications" relatedHref={openHref}>
      {order ? (
        <section className="mt-6 rounded-2xl bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Order</p>
              <h2 className="mt-1 text-lg font-semibold">{order.order_number}</h2>
              <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{order.customer_name || "Customer"}{order.customer_phone ? ` · ${order.customer_phone}` : ""}</p>
            </div>
            <StatusBadge value={order.status} />
          </div>
          <p className="mt-3 text-sm">{money(order.total)} · {paymentMethodLabel(order.payment_method)}</p>
          <p className="mt-1 text-xs text-[var(--lagecto-muted)]">{formatDateTime(order.created_at)}</p>
          <div className="mt-4 grid gap-2">
            {orderLines(order.items).map((line) => (
              <p key={line.key} className="text-sm">
                {line.name} × {line.quantity} · {money(line.lineTotal)}
              </p>
            ))}
          </div>
          <div className="mt-4">
            {order.status !== "completed" && order.status !== "cancelled" && order.status !== "refunded" ? (
              <CompleteOrderButton orderId={order.id} />
            ) : (
              <Link href={`/shop/orders/${order.id}`} className="text-sm font-semibold text-[#0B6E4F]">
                Open order
              </Link>
            )}
          </div>
        </section>
      ) : null}
      {enquiry ? (
        <section className="mt-6 rounded-2xl bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Enquiry</p>
              <h2 className="mt-1 text-lg font-semibold">{enquiry.title}</h2>
              <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{enquiry.customer_name || "Customer"}</p>
            </div>
            <StatusBadge value={enquiry.status} />
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{enquiry.details || "No extra details were saved."}</p>
          <Link href={`/shop/service-requests/${enquiry.id}`} className="mt-4 inline-block text-sm font-semibold text-[#0B6E4F]">
            Open enquiry
          </Link>
        </section>
      ) : null}
    </NotificationRead>
  );
}
