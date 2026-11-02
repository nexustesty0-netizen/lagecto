import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { NotificationRead } from "@/components/notifications/NotificationRead";
import { StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { noticeKind, notificationRelatedHref } from "@/lib/notifications";

type OrderItem = { name?: string; quantity?: number; price?: number; line_total?: number; product_name?: string };

export default async function CustomerNotificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("customer");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: item } = await supabase.from("notifications").select("*").eq("user_id", profile.id).eq("id", id).maybeSingle();
  if (!item) notFound();
  if (!item.is_read) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", item.id).eq("user_id", profile.id);
  }

  const kind = noticeKind(item.type);
  const relatedHref = notificationRelatedHref(item, "customer");
  let order: { id: string; order_number: string; total: number; status: string; items: unknown; created_at: string; shops?: { name?: string } | { name?: string }[] | null } | null = null;
  let enquiry: { id: string; title: string; details: string | null; status: string; shops?: { name?: string } | { name?: string }[] | null } | null = null;

  if (kind === "order" && item.reference_id) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total, status, items, created_at, shops(name)")
      .eq("id", item.reference_id)
      .eq("customer_id", profile.id)
      .maybeSingle();
    order = data;
  }
  if ((kind === "enquiry" || kind === "request") && item.reference_id) {
    const { data } = await supabase
      .from("service_requests")
      .select("id, title, details, status, shops(name)")
      .eq("id", item.reference_id)
      .eq("customer_id", profile.id)
      .maybeSingle();
    enquiry = data;
  }

  function shopName(value: unknown) {
    if (Array.isArray(value)) return String(value[0]?.name || "Shop");
    return String((value as { name?: string } | null)?.name || "Shop");
  }

  const openHref = order ? `/customer/orders/${order.id}` : enquiry ? `/customer/requests/${enquiry.id}` : relatedHref;
  const lines = (Array.isArray(order?.items) ? order.items : []).map((row: OrderItem, index: number) => ({
    key: `${row.name || row.product_name || "Item"}-${index}`,
    name: String(row.name || row.product_name || "Item"),
    quantity: Number(row.quantity || 1),
    lineTotal: Number(row.line_total ?? Number(row.price || 0) * Number(row.quantity || 1)),
  }));

  return (
    <NotificationRead item={item} backHref="/customer/notifications" relatedHref={openHref}>
      {order ? (
        <section className="mt-6 rounded-2xl bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Order</p>
          <h2 className="mt-1 text-lg font-semibold">{order.order_number}</h2>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{shopName(order.shops)}</p>
          <p className="mt-2 text-sm">{money(order.total)}</p>
          <StatusBadge value={order.status} />
          <p className="mt-2 text-xs text-[var(--lagecto-muted)]">{formatDateTime(order.created_at)}</p>
          <div className="mt-4 grid gap-2">
            {lines.map((line) => (
              <p key={line.key} className="text-sm">
                {line.name} × {line.quantity} · {money(line.lineTotal)}
              </p>
            ))}
          </div>
          <Link href={`/customer/orders/${order.id}`} className="mt-4 inline-block text-sm font-semibold text-[#0B6E4F]">
            Open order
          </Link>
        </section>
      ) : null}
      {enquiry ? (
        <section className="mt-6 rounded-2xl bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lagecto-muted)]">Enquiry</p>
          <h2 className="mt-1 text-lg font-semibold">{enquiry.title}</h2>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{shopName(enquiry.shops)}</p>
          <StatusBadge value={enquiry.status} />
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{enquiry.details || "No extra details were saved."}</p>
        </section>
      ) : null}
    </NotificationRead>
  );
}
