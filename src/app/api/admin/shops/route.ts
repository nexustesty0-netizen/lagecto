import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile("admin");
    if (!auth.ok) return auth.error;
    const body = await request.json();
    const action = String(body.action || "");
    const supabase = await createServerSupabase();
    const shopId = String(body.shopId || "");
    if (!shopId) return NextResponse.json({ error: "Shop is required." }, { status: 400 });

    if (action === "update") {
      const patch: Record<string, unknown> = {};
      if (body.name) patch.name = String(body.name).trim();
      if (body.status === "active" || body.status === "inactive" || body.status === "pending") {
        patch.status = body.status;
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
      return NextResponse.json({ ok: true });
    }

    if (action === "assign_plan") {
      const { data, error } = await supabase.rpc("admin_assign_subscription", {
        p_shop_id: shopId,
        p_plan_id: String(body.planId || ""),
      });
      if (error) return NextResponse.json({ error: "Unable to assign this plan." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}
