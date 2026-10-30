import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { ChatClient } from "@/components/chat/ChatClient";
import { attachUnread } from "@/lib/chat";

export default async function CustomerChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const profile = await requireRole("customer");
  const { c } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, kind, shop_id, customer_id, can_reply, title, created_at, last_message_at, last_message_preview, shops(name, logo_url)")
    .eq("customer_id", profile.id)
    .order("last_message_at", { ascending: false });
  const withUnread = await attachUnread(supabase, conversations || [], profile.id);
  const active = withUnread.find((row) => row.id === c);
  const { data: messages } = active
    ? await supabase.from("chat_messages").select("*").eq("conversation_id", active.id).order("created_at")
    : { data: [] };
  return (
    <>
      <PageHeader title="My chats" subtitle="Message shops from a shop page. You cannot search or message other customers. LaGecto announcements have no reply box." />
      <ChatClient
        conversations={withUnread}
        messages={messages || []}
        activeId={active?.id || null}
        userId={profile.id}
        title="My chats"
      />
    </>
  );
}
