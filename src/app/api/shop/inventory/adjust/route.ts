import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopFeature } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShopFeature("inventory");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId || "");
  const delta = Number(body.delta);
  if (!productId || !Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Invalid stock adjustment." }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("shop_id", auth.shop.id)
    .maybeSingle();
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const { data, error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: productId,
    p_delta: Math.trunc(delta),
    p_reason: String(body.reason || "adjustment"),
    p_notes: body.notes || null,
  });
  if (error) return NextResponse.json({ error: "Unable to adjust stock." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
