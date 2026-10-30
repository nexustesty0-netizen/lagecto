import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const caseId = String(body.caseId || "");
  const message = String(body.body || "");
  if (!caseId) return NextResponse.json({ error: "Missing request." }, { status: 400 });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("reply_support_case", { p_case_id: caseId, p_body: message });
  if (error) return NextResponse.json({ error: "Unable to send this reply." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
