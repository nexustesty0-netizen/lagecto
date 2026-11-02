import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAdminLevel, requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile("admin");
    if (!auth.ok) return auth.error;
    const body = await request.json();
    const action = String(body.action || "");
    const supabase = await createServerSupabase();
    const shopId = String(body.shopId || "");
    if (!shopId) return NextResponse.json({ error: "Shop is required." }, { status: 400 });

    if (action === "regenerate_login_id") {
      const regen = await requireApiAdminLevel("admin");
      if (!regen.ok) return regen.error;
      const { data, error } = await supabase.rpc("admin_regenerate_shop_login_id", { p_shop_id: shopId });
      if (error) return NextResponse.json({ error: "Unable to regenerate this Shop ID." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      await supabase.rpc("admin_audit_action", { p_event_type: "shop_login_id_regenerated", p_target_shop_id: shopId });
      return NextResponse.json({
        ok: true,
        shop_id: data?.shop_id,
        shop_name: data?.shop_name,
        login_shop_id: data?.login_shop_id,
        previous_login_shop_id: data?.previous_login_shop_id,
      });
    }

    if (action === "update") {
      const updater = await requireApiAdminLevel("admin");
      if (!updater.ok) return updater.error;
      const patch: Record<string, unknown> = {};
      if (body.name) patch.name = String(body.name).trim();
      if (body.status === "active" || body.status === "inactive" || body.status === "pending") {
        patch.status = body.status;
      }
      if (body.verificationStatus === "unverified" || body.verificationStatus === "pending" || body.verificationStatus === "verified" || body.verificationStatus === "rejected") {
        patch.verification_status = body.verificationStatus;
      }
      if (body.category) patch.category = String(body.category);
      if (body.providerType === "products" || body.providerType === "services" || body.providerType === "both") {
        patch.provider_type = body.providerType;
      }
      if (body.phone != null) patch.phone = String(body.phone);
      if (body.address != null) patch.address = String(body.address);
      if (body.about != null) patch.about = String(body.about);
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("shops").update(patch).eq("id", shopId);
      if (error) return NextResponse.json({ error: "Unable to update this shop." }, { status: 400 });
      await supabase.rpc("admin_audit_action", {
        p_event_type: "shop_updated",
        p_target_shop_id: shopId,
        p_identifier: String(patch.status || patch.verification_status || "updated"),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const deleter = await requireApiAdminLevel("super_admin");
      if (!deleter.ok) return deleter.error;
      const { data, error } = await supabase.rpc("admin_delete_shop", { p_shop_id: shopId });
      if (error) {
        const missing = /could not find|does not exist|schema cache/i.test(error.message || "");
        return NextResponse.json(
          { error: missing ? "Run the latest admin delete SQL in Supabase first." : "Unable to delete this shop." },
          { status: 400 },
        );
      }
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      await supabase.rpc("admin_audit_action", { p_event_type: "shop_deleted", p_target_shop_id: shopId });
      return NextResponse.json({ ok: true, shop_name: data?.shop_name });
    }

    if (action === "assign_plan") {
      const assigner = await requireApiAdminLevel("admin");
      if (!assigner.ok) return assigner.error;
      const { data, error } = await supabase.rpc("admin_assign_subscription", {
        p_shop_id: shopId,
        p_plan_id: String(body.planId || ""),
      });
      if (error) return NextResponse.json({ error: "Unable to assign this plan." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      await supabase.rpc("admin_audit_action", { p_event_type: "shop_package_assigned", p_target_shop_id: shopId });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}
