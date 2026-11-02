import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopFeature } from "@/lib/auth/session";
import { signedStockDelta, type StockMoveKind } from "@/lib/shop/inventory-math";

export async function POST(request: Request) {
  const auth = await requireApiShopFeature("inventory");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId || "");
  const reason = String(body.reason || "adjustment");
  const notes = String(body.notes || "").trim().slice(0, 400);
  const kind = (["in", "out", "set"].includes(String(body.kind || "")) ? String(body.kind) : null) as StockMoveKind | null;
  const supabase = await createServerSupabase();
  const { data: product } = await supabase
    .from("products")
    .select("id, stock, type")
    .eq("id", productId)
    .eq("shop_id", auth.shop.id)
    .maybeSingle();
  if (!product || product.type !== "product") return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const delta = kind
    ? signedStockDelta(kind, Number(body.quantity || 0), Number(product.stock || 0), Number(body.target))
    : Math.trunc(Number(body.delta));
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "Invalid stock adjustment." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: productId,
    p_delta: delta,
    p_reason: reason,
    p_notes: notes || null,
  });
  if (error) return NextResponse.json({ error: "Unable to adjust stock." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error || "Unable to adjust stock." }, { status: 400 });
  return NextResponse.json(data);
}
