import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_update_manager_report", {
    p_report_id: String(body.id || ""),
    p_status: body.status || null,
    p_reply: body.reply || null,
  });
  if (error) return NextResponse.json({ error: "Unable to update this report." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
