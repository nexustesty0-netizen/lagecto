import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-error";
import { loadChatMessages } from "@/lib/chat";
import { asUuid } from "@/lib/chat-privacy";

export async function GET(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const conversationId = asUuid(new URL(request.url).searchParams.get("c"));
  if (!conversationId) return jsonError("chat.messages", "Conversation not found.", 400);

  const supabase = await createServerSupabase();
  const messages = await loadChatMessages(supabase, conversationId, auth.profile.id);
  return NextResponse.json({ messages });
}
