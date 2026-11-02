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
  const text = String(body.body || "").trim().slice(0, 4000);
  if (!conversationId) return jsonError("chat.send", "Conversation not found.", 400);
  if (!text) return jsonError("chat.send", "Write a message.", 400);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: text,
  });
  if (error) return jsonError("chat.send", "Unable to send this message.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    message_id: data?.message_id,
    created_at: data?.created_at || new Date().toISOString(),
  });
}
