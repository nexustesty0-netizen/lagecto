import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api-error";
import { asCartUuid, normalizeCartQty } from "@/lib/cart-math";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const shopId = asCartUuid(body.shopId);
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((item: { productId?: string; product_id?: string; quantity?: number }) => ({
      product_id: asCartUuid(item.productId || item.product_id),
      quantity: normalizeCartQty(item.quantity),
    }))
    .filter((item: { product_id: string | null; quantity: number }) => item.product_id && item.quantity > 0)
    .slice(0, 80);
  if (!shopId) return jsonError("cart.quote", "Missing shop.", 400);
  if (!items.length) return jsonError("cart.quote", "Your cart for this shop is empty.", 400);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("quote_customer_cart", {
    p_shop_id: shopId,
    p_items: items,
    p_promo_code: body.promoCode ? String(body.promoCode).trim().slice(0, 40) : null,
  });
  if (error) return jsonError("cart.quote", "Unable to price this cart.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
