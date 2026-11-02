import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAdminLevel } from "@/lib/auth/session";
import { normalizePromoCode } from "@/lib/loyalty/promo-math";

export async function POST(request: Request) {
  const auth = await requireApiAdminLevel("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const supabase = await createServerSupabase();

  if (action === "update_badge") {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["is_active", "is_visible", "name", "description", "rarity", "category", "icon"] as const) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const { error } = await supabase.from("customer_badge_definitions").update(patch).eq("id", String(body.id || ""));
    if (error) return NextResponse.json({ error: "Unable to update badge." }, { status: 400 });
    await supabase.rpc("log_security_event", {
      p_event_type: "admin_badge_update",
      p_actor_id: auth.profile.id,
      p_identifier: String(body.id || ""),
      p_result: "success",
      p_metadata: { action },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "grant_badge") {
    const { data, error } = await supabase.rpc("admin_grant_badge", {
      p_user_id: body.userId,
      p_badge_id: body.badgeId,
      p_reason: String(body.reason || ""),
    });
    if (error) return NextResponse.json({ error: "Unable to grant badge." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "save_campaign") {
    const payload = {
      slug: String(body.slug || "").trim(),
      name: String(body.name || "").trim(),
      description: String(body.description || ""),
      kind: String(body.kind || "loyalty"),
      is_active: Boolean(body.is_active),
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      max_enrollments: body.max_enrollments ? Number(body.max_enrollments) : null,
      eligibility: body.eligibility || {},
      benefit: body.benefit || {},
      updated_at: new Date().toISOString(),
    };
    if (!payload.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (body.id) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", body.id);
      if (error) return NextResponse.json({ error: "Unable to update campaign." }, { status: 400 });
    } else {
      const { error } = await supabase.from("campaigns").insert({ ...payload, created_by: auth.profile.id });
      if (error) return NextResponse.json({ error: "Unable to create campaign." }, { status: 400 });
    }
    await supabase.rpc("log_security_event", {
      p_event_type: "admin_campaign_save",
      p_actor_id: auth.profile.id,
      p_identifier: payload.name,
      p_result: "success",
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_promo") {
    const code = normalizePromoCode(String(body.code || ""));
    if (code.length < 3) return NextResponse.json({ error: "Enter a promo code." }, { status: 400 });
    const payload = {
      code,
      name: String(body.name || code),
      description: String(body.description || ""),
      owner_scope: "platform",
      shop_id: null,
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
      is_active: body.is_active !== false,
      eligible_shop_ids: Array.isArray(body.eligible_shop_ids) ? body.eligible_shop_ids : [],
      required_loyalty_level_id: body.required_loyalty_level_id || null,
    };
    if (body.id) {
      const { error } = await supabase.from("promo_codes").update(payload).eq("id", body.id);
      if (error) return jsonError("admin.loyalty.update", "Unable to update code.", 400, error);
    } else {
      const { error } = await supabase.from("promo_codes").insert(payload);
      if (error) return jsonError("admin.loyalty.create", "Unable to create code.", 400, error);
    }
    await supabase.rpc("log_security_event", {
      p_event_type: "admin_promo_save",
      p_actor_id: auth.profile.id,
      p_identifier: code,
      p_result: "success",
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_reward") {
    const { data: program } = await supabase.from("loyalty_programs").select("id").eq("scope", "platform").maybeSingle();
    const payload = {
      program_id: program?.id,
      shop_id: null,
      name: String(body.name || "").trim(),
      description: String(body.description || ""),
      reward_type: String(body.reward_type || "percent_discount"),
      value: Number(body.value || 0),
      requirements: body.requirements || {},
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      usage_limit: body.usage_limit ? Number(body.usage_limit) : null,
      per_customer_limit: Number(body.per_customer_limit || 1),
      is_active: body.is_active !== false,
      created_by: auth.profile.id,
    };
    if (!payload.name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const { error } = body.id
      ? await supabase.from("rewards").update(payload).eq("id", body.id)
      : await supabase.from("rewards").insert(payload);
    if (error) return NextResponse.json({ error: "Unable to save reward." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_level") {
    const { data: program } = await supabase.from("loyalty_programs").select("id").eq("scope", "platform").maybeSingle();
    const payload = {
      program_id: program?.id,
      slug: String(body.slug || "").trim(),
      name: String(body.name || "").trim(),
      description: String(body.description || ""),
      icon: String(body.icon || "sparkles"),
      rank: Number(body.rank || 1),
      min_points: Number(body.min_points || 0),
      discount_percent: Number(body.discount_percent || 0),
      is_active: body.is_active !== false,
    };
    if (!payload.name || !payload.slug) return NextResponse.json({ error: "Name and slug are required." }, { status: 400 });
    const { error } = body.id
      ? await supabase.from("loyalty_levels").update(payload).eq("id", body.id)
      : await supabase.from("loyalty_levels").insert(payload);
    if (error) return NextResponse.json({ error: "Unable to save level." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
