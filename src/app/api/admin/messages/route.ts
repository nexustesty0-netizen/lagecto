import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAdminLevel } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiAdminLevel("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_broadcast_message", {
    p_audience: String(body.audience || ""),
    p_title: String(body.title || ""),
    p_body: String(body.message || body.body || ""),
    p_target_id: body.targetId || null,
  });
  if (error) return NextResponse.json({ error: "Unable to send this update." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
