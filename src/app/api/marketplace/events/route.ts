import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const TYPES = new Set(["product_view", "shop_view", "add_to_cart", "search", "promotion_click", "ad_click"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const eventType = String(body.eventType || "");
  if (!TYPES.has(eventType)) {
    return NextResponse.json({ error: "Unsupported event." }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("record_marketplace_event", {
    p_event_type: eventType,
    p_shop_id: body.shopId || null,
    p_product_id: body.productId || null,
    p_promotion_id: body.promotionId || null,
    p_ad_id: body.adId || null,
    p_query: String(body.query || "").slice(0, 80) || null,
  });
  if (error) return NextResponse.json({ error: "Unable to record event." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
