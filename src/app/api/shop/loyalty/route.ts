import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";
import { normalizePromoCode } from "@/lib/loyalty/promo-math";

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const supabase = await createServerSupabase();
  const shopId = auth.shop.id;

  if (action === "save_promo") {
    const code = normalizePromoCode(String(body.code || ""));
    if (code.length < 3) return NextResponse.json({ error: "Enter a promo code." }, { status: 400 });
    const payload = {
      code,
      name: String(body.name || code),
      description: String(body.description || ""),
      owner_scope: "shop" as const,
      shop_id: shopId,
      created_by: auth.profile.id,
      discount_type: String(body.discount_type || "percent"),
      percent_off: body.discount_type === "percent" ? Number(body.percent_off || 0) : null,
      amount_off: body.discount_type === "fixed" ? Number(body.amount_off || 0) : null,
      max_discount: body.max_discount ? Number(body.max_discount) : null,
      min_order_amount: Number(body.min_order_amount || 0),
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      total_usage_limit: body.total_usage_limit ? Number(body.total_usage_limit) : null,
      per_customer_limit: Number(body.per_customer_limit || 1),
      customer_segment: String(body.customer_segment || "all"),
      loyalty_only: Boolean(body.loyalty_only),
      required_loyalty_level_id: body.required_loyalty_level_id || null,
      is_active: true,
    };
    const { error } = await supabase.from("promo_codes").insert(payload);
    if (error) return NextResponse.json({ error: error.message || "Unable to create this shop code." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_reward") {
    const { data: program } = await supabase.from("loyalty_programs").select("id").eq("shop_id", shopId).maybeSingle();
    const payload = {
      program_id: program?.id,
      shop_id: shopId,
      name: String(body.name || "").trim(),
      description: String(body.description || ""),
      reward_type: String(body.reward_type || "percent_discount"),
      value: Number(body.value || 0),
      requirements: body.requirements || { all: [{ metric: "completed_orders", gte: Number(body.order_threshold || 1) }] },
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      per_customer_limit: 1,
      is_active: true,
      created_by: auth.profile.id,
    };
    if (!payload.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const { error } = await supabase.from("rewards").insert(payload);
    if (error) return NextResponse.json({ error: "Unable to save this shop reward." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
