import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { SELF_SERVE_SHOP_CREATION } from "@/lib/platform-flags";

export async function POST(request: Request) {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  if (key !== SELF_SERVE_SHOP_CREATION) {
    return NextResponse.json({ error: "Unknown setting." }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_set_platform_flag", {
    p_key: key,
    p_enabled: Boolean(body.enabled),
  });
  if (error) return NextResponse.json({ error: "Unable to update this setting." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
