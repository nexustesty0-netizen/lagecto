import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import {
  STEBO_BUILTIN_KNOWLEDGE,
  localReply,
  promptForMode,
  retrieve,
  type SteboExample,
  type SteboKnowledge,
} from "@/lib/stebo";

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile();
    if (!auth.ok) return auth.error;
    const body = await request.json();
    const message = String(body.message || "").trim();
    const requestedMode = String(body.mode || "personal");
    const mode =
      requestedMode === "admin"
        ? auth.profile.role === "admin"
          ? "admin"
          : "personal"
        : requestedMode.startsWith("business") || ["marketing", "sales", "inventory", "customers", "general"].includes(requestedMode)
          ? auth.profile.role === "shop_owner" || auth.profile.role === "admin"
            ? requestedMode
            : "personal"
          : requestedMode;
    if (!message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

    const supabase = await createServerSupabase();
    const [{ data: knowledge }, { data: examples }, { data: personality }] = await Promise.all([
      supabase.from("stebo_knowledge").select("title, body, section").eq("is_active", true).limit(80),
      supabase.from("stebo_training_examples").select("prompt, response").limit(40),
      supabase.from("stebo_personality_settings").select("display_name, traits").eq("id", 1).maybeSingle(),
    ]);

    const rows = [...STEBO_BUILTIN_KNOWLEDGE, ...((knowledge || []) as SteboKnowledge[])];
    const exampleRows = (examples || []) as SteboExample[];
    const name = personality?.display_name || "Stebo";
    const { snippets, example } = retrieve(message, rows, exampleRows);
    const apiUrl = process.env.STEBO_API_URL;

    let reply: string | null = null;
    if (apiUrl) {
      try {
        const remote = await fetch(`${apiUrl.replace(/\/$/, "")}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            mode,
            userId: auth.profile.id,
            role: auth.profile.role,
            system: promptForMode(mode),
            knowledge: snippets,
          }),
        });
        if (remote.ok) {
          const payload = await remote.json();
          reply = String(payload.reply || payload.message || payload.content || "");
        }
      } catch {
        reply = null;
      }
    }

    if (!reply) reply = localReply(message, snippets, example, name, mode);

    let conversationId = String(body.conversationId || "");
    if (conversationId) {
      const { data: existing } = await supabase
        .from("stebo_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", auth.profile.id)
        .maybeSingle();
      if (!existing?.id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    } else {
      const { data: conversation } = await supabase
        .from("stebo_conversations")
        .insert({ user_id: auth.profile.id, mode, title: message.slice(0, 80) })
        .select("id")
        .single();
      conversationId = conversation?.id || "";
    }

    if (conversationId) {
      await supabase.from("stebo_messages").insert([
        { conversation_id: conversationId, role: "user", content: message },
        { conversation_id: conversationId, role: "assistant", content: reply },
      ]);
    }

    return NextResponse.json({ ok: true, reply, conversationId });
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}
