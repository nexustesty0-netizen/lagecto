import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { promptForMode } from "@/lib/stebo";
import { CONTACT } from "@/lib/brand";

type KnowledgeRow = { title: string; body: string; section: string };
type ExampleRow = { prompt: string; response: string };

function retrieve(question: string, knowledge: KnowledgeRow[], examples: ExampleRow[]) {
  const q = question.toLowerCase();
  const scored = knowledge
    .map((row) => {
      const hay = `${row.title} ${row.body} ${row.section}`.toLowerCase();
      const hits = q.split(/\s+/).filter((word) => word.length > 2 && hay.includes(word)).length;
      return { row, hits };
    })
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const example = examples.find((item) => q.includes(item.prompt.toLowerCase().slice(0, 24)));
  return { snippets: scored.slice(0, 4).map((item) => item.row), example };
}

function fallbackReply(message: string, snippets: KnowledgeRow[], example: ExampleRow | undefined, personalityName: string) {
  if (example) return example.response;
  if (snippets.length) {
    const body = snippets.map((row) => `${row.title}: ${row.body}`).join("\n\n");
    return `${personalityName} here. Here's what I know that's relevant:\n\n${body}`;
  }
  const q = message.toLowerCase();
  if (q.includes("support") || q.includes("help") || q.includes("contact")) {
    return `You can reach LaGecto Support on ${CONTACT.phoneDisplay} or ${CONTACT.email}.`;
  }
  return null;
}

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

    const rows = (knowledge || []) as KnowledgeRow[];
    const exampleRows = (examples || []) as ExampleRow[];
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

    if (!reply) reply = fallbackReply(message, snippets, example, name);
    if (!reply) {
      return NextResponse.json({
        error: "Stebo is not configured yet. Add knowledge in the admin Intelligence Center, or set STEBO_API_URL.",
        setup: true,
      }, { status: 503 });
    }

    let conversationId = String(body.conversationId || "");
    if (!conversationId) {
      const { data: conversation, error } = await supabase
        .from("stebo_conversations")
        .insert({ user_id: auth.profile.id, mode, title: message.slice(0, 80) })
        .select("id")
        .single();
      if (error || !conversation) return NextResponse.json({ error: "Unable to start this conversation." }, { status: 400 });
      conversationId = conversation.id;
    }

    await supabase.from("stebo_messages").insert([
      { conversation_id: conversationId, role: "user", content: message },
      { conversation_id: conversationId, role: "assistant", content: reply },
    ]);

    return NextResponse.json({ ok: true, reply, conversationId });
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}
