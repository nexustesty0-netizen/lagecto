import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const shopId = String(body.shopId || "");
  const items = Array.isArray(body.items) ? body.items : [];
  if (!shopId) return NextResponse.json({ error: "Missing shop." }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("quote_customer_cart", {
    p_shop_id: shopId,
    p_items: items.map((item: { productId?: string; product_id?: string; quantity: number }) => ({
      product_id: item.productId || item.product_id,
      quantity: item.quantity,
    })),
    p_promo_code: body.promoCode ? String(body.promoCode) : null,
  });
  if (error) return NextResponse.json({ error: "Unable to price this cart." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
