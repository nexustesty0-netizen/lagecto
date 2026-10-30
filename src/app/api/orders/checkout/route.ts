import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/session";
import { buildShopOrderWhatsAppText, shopCheckoutWhatsAppUrl } from "@/lib/checkout/whatsapp-order";

type CartItemBody = { productId?: string; product_id?: string; quantity?: number; name?: string };

function mapItems(items: CartItemBody[]) {
  return items.map((item) => ({
    product_id: item.productId || item.product_id,
    quantity: Number(item.quantity || 1),
  }));
}

export async function POST(request: Request) {
  const profile = await getProfile();
  const body = await request.json().catch(() => ({}));
  const shopId = String(body.shopId || "");
  const items = Array.isArray(body.items) ? mapItems(body.items) : [];
  const guestName = String(body.guestName || "").trim();
  const guestPhone = String(body.guestPhone || "").trim();
  if (!shopId || !items.length) {
    return NextResponse.json({ error: "Your cart for this shop is empty." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const asCustomer = profile?.role === "customer" && profile.account_status === "active";
  const { data, error } = asCustomer
    ? await supabase.rpc("place_customer_order", {
        p_shop_id: shopId,
        p_items: items,
        p_payment_method: "whatsapp",
        p_notes: "Payment handled directly between customer and shop through WhatsApp.",
        p_promo_code: body.promoCode ? String(body.promoCode) : null,
      })
    : await supabase.rpc("place_guest_order", {
        p_shop_id: shopId,
        p_items: items,
        p_customer_name: guestName,
        p_customer_phone: guestPhone || null,
        p_notes: "Guest WhatsApp order. Payment arranged directly with the shop.",
      });

  if (error) return NextResponse.json({ error: "Unable to place this order." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });

  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, whatsapp_number, phone")
    .eq("id", shopId)
    .maybeSingle();

  const products = (Array.isArray(data.items) ? data.items : []).map(
    (item: { name?: string; quantity?: number; price?: number; line_total?: number }) => ({
      name: String(item.name || "Item"),
      quantity: Number(item.quantity || 1),
      lineTotal: Number(item.line_total ?? Number(item.price || 0) * Number(item.quantity || 1)),
    }),
  );

  const text = buildShopOrderWhatsAppText({
    shopName: shop?.name || "this shop",
    orderNumber: data.order_number,
    products,
    total: Number(data.total || 0),
    guestName: asCustomer ? profile?.name || undefined : guestName,
    guestPhone: asCustomer ? profile?.phone || undefined : guestPhone || undefined,
  });
  const whatsappUrl = shopCheckoutWhatsAppUrl(shop?.whatsapp_number || shop?.phone, text);

  return NextResponse.json({
    ok: true,
    order_id: data.order_id,
    order_number: data.order_number,
    shop_id: shopId,
    shop_name: shop?.name || null,
    total: data.total,
    status: "pending",
    payment_status: "pending",
    payment_method: "whatsapp",
    checkout: "whatsapp",
    guest: !asCustomer,
    whatsapp_url: whatsappUrl,
    items: products,
  });
}
