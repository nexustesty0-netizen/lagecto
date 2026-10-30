import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("send_chat_message", {
    p_conversation_id: String(body.conversationId || ""),
    p_body: String(body.body || ""),
  });
  if (error) return NextResponse.json({ error: "Unable to send this message." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
