import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/session";
import { normalizePromoCode } from "@/lib/loyalty/promo-math";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const shopId = String(body.shopId || "");
  const code = normalizePromoCode(String(body.code || ""));
  const items = Array.isArray(body.items) ? body.items : [];
  if (!shopId || !code) return NextResponse.json({ error: "Enter a promo code." }, { status: 400 });
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Sign in to apply a promo code." }, { status: 401 });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("validate_promo_code", {
    p_code: code,
    p_shop_id: shopId,
    p_items: items.map((item: { productId?: string; product_id?: string; quantity: number }) => ({
      product_id: item.productId || item.product_id,
      quantity: item.quantity,
    })),
    p_lock: false,
  });
  if (error) return NextResponse.json({ error: "Unable to check this code." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
