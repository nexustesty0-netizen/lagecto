import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAdminLevel } from "@/lib/auth/session";
import { TOGGLEABLE_FEATURES } from "@/lib/features";

const ALLOWED = new Set(TOGGLEABLE_FEATURES.map((item) => item.key));

export async function POST(request: Request) {
  const auth = await requireApiAdminLevel("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const feature = String(body.feature || "");
  if (!ALLOWED.has(feature as (typeof TOGGLEABLE_FEATURES)[number]["key"])) {
    return NextResponse.json({ error: "Unknown feature." }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_set_shop_feature", {
    p_shop_id: String(body.shopId || ""),
    p_feature: feature,
    p_enabled: Boolean(body.enabled),
    p_note: body.note || null,
  });
  if (error) return NextResponse.json({ error: "Unable to update feature access." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
