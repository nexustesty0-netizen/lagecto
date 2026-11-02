import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-error";
import { asUuid } from "@/lib/chat-privacy";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const conversationId = asUuid(body.conversationId);
  if (!conversationId) return jsonError("chat.read", "Conversation not found.", 400);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("mark_chat_read", { p_conversation_id: conversationId });
  if (error) return jsonError("chat.read", "Unable to update read status.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
