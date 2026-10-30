import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui/primitives";
import { formatDateTime, money } from "@/lib/format";
import { paymentMethodLabel } from "@/lib/payments/methods";
import { buildShopOrderWhatsAppText, shopCheckoutWhatsAppUrl } from "@/lib/checkout/whatsapp-order";

type OrderItem = { name?: string; quantity?: number; price?: number; line_total?: number; product_name?: string };

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("customer");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, total, status, payment_method, payment_status, items, created_at, shops(name, whatsapp_number, phone)")
    .eq("id", id)
    .eq("customer_id", profile.id)
    .maybeSingle();
  if (!order) notFound();
  const shop = order.shops as { name?: string; whatsapp_number?: string | null; phone?: string | null } | null;
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, receipt_number")
    .eq("order_id", order.id)
    .eq("customer_id", profile.id);

  const products = (Array.isArray(order.items) ? order.items : []).map((item: OrderItem) => ({
    name: String(item.name || item.product_name || "Item"),
    quantity: Number(item.quantity || 1),
    lineTotal: Number(item.line_total ?? Number(item.price || 0) * Number(item.quantity || 1)),
  }));
  const whatsappText = buildShopOrderWhatsAppText({
    shopName: shop?.name || "this shop",
    orderNumber: order.order_number,
    products,
    total: Number(order.total || 0),
  });
  const whatsappUrl = shopCheckoutWhatsAppUrl(shop?.whatsapp_number || shop?.phone, whatsappText);

  return (
    <>
      <PageHeader title={order.order_number} subtitle={shop?.name} />
      <div className="rounded-2xl bg-white p-5">
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
        <p className="mt-2 text-sm text-[#6B7280]">{formatDateTime(order.created_at)}</p>
        <p className="mt-4 text-sm text-[#6B7280]">Payment is arranged directly with the shop. LaGecto does not collect this payment.</p>
        {whatsappUrl && order.status !== "completed" && order.status !== "cancelled" ? (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white">
            Continue on WhatsApp
          </a>
        ) : null}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Items</h2>
      <div className="grid gap-2">
        {products.map((product, index) => (
          <article key={`${product.name}-${index}`} className="rounded-2xl bg-white p-4 text-sm">
            <p className="font-semibold">
              {product.name} × {product.quantity}
            </p>
            <p className="text-[#6B7280]">{money(product.lineTotal)}</p>
          </article>
        ))}
      </div>
      {receipts?.length ? (
        <div className="mt-6 grid gap-2">
          {receipts.map((receipt) => (
            <Link key={receipt.id} href={`/customer/receipts/${receipt.id}`} className="text-sm text-[#0B6E4F]">
              Receipt {receipt.receipt_number}
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}
