import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAdminLevel } from "@/lib/auth/session";
import {
  PACKAGE_META,
  isPaidPackage,
  normalizeDurationKey,
  normalizePackageKey,
  planSlug,
} from "@/lib/packages";

export async function POST(request: Request) {
  try {
    const auth = await requireApiAdminLevel("admin");
    if (!auth.ok) return auth.error;
    const body = await request.json();
    const action = String(body.action || "");
    const supabase = await createServerSupabase();

    if (action === "assign") {
      const { data, error } = await supabase.rpc("admin_assign_subscription", {
        p_shop_id: String(body.shopId || ""),
        p_plan_id: String(body.planId || ""),
      });
      if (error) return NextResponse.json({ error: "Unable to assign this plan." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "upsert") {
      const packageKey = normalizePackageKey(body.packageKey);
      const paidKey = isPaidPackage(packageKey) ? packageKey : "thabi";
      const durationMonths = Number(body.durationMonths || 1);
      const durationKey = normalizeDurationKey(body.durationKey, durationMonths);
      const meta = PACKAGE_META[paidKey];
      const payload = {
        name: String(body.name || meta.name),
        slug: String(body.slug || planSlug(paidKey, durationKey)),
        package_key: paidKey,
        duration_key: durationKey,
        price: Number(body.price || meta.monthlyPrice),
        promo_price: body.promoPrice == null || body.promoPrice === "" ? null : Number(body.promoPrice),
        promo_label: String(body.promoLabel || "") || null,
        billing_period: String(body.billingPeriod || (durationMonths >= 12 ? "yearly" : "monthly")),
        duration_months: durationMonths,
        trial_days: Number(body.trialDays || 14),
        is_trial_available: body.isTrialAvailable !== false,
        description: String(body.description || meta.description),
        display_order: Number(body.displayOrder || 0),
        features: body.features || [...meta.features],
        is_active: body.isActive !== false,
      };
      if (body.id) {
        const { error } = await supabase.from("subscription_plans").update(payload).eq("id", body.id);
        if (error) return NextResponse.json({ error: "Unable to update this plan." }, { status: 400 });
        await supabase.rpc("log_security_event", {
          p_event_type: "admin_package_update",
          p_actor_id: auth.profile.id,
          p_identifier: payload.slug,
          p_result: "success",
          p_metadata: { plan_id: body.id, price: payload.price },
        });
      } else {
        const { error } = await supabase.from("subscription_plans").insert(payload);
        if (error) return NextResponse.json({ error: "Unable to create this plan." }, { status: 400 });
        await supabase.rpc("log_security_event", {
          p_event_type: "admin_package_create",
          p_actor_id: auth.profile.id,
          p_identifier: payload.slug,
          p_result: "success",
          p_metadata: { price: payload.price },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "toggle") {
      const { error } = await supabase.from("subscription_plans").update({ is_active: Boolean(body.isActive) }).eq("id", body.id);
      if (error) return NextResponse.json({ error: "Unable to update this plan." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return NextResponse.json({ error: "Missing plan id." }, { status: 400 });
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) return NextResponse.json({ error: "Unable to delete this plan." }, { status: 400 });
      await supabase.rpc("log_security_event", {
        p_event_type: "admin_package_delete",
        p_actor_id: auth.profile.id,
        p_identifier: id,
        p_result: "success",
        p_metadata: { plan_id: id },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}
