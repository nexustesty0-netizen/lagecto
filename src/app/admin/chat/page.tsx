import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { ChatClient } from "@/components/chat/ChatClient";
import { attachUnread } from "@/lib/chat";

export default async function AdminChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const profile = await requireRole("admin");
  const { c } = await searchParams;
  const supabase = await createServerSupabase();
  const [{ data: conversations }, { data: shops }] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select("id, kind, shop_id, customer_id, can_reply, title, created_at, last_message_at, last_message_preview, shops(name, logo_url, login_shop_id, verification_status)")
      .in("kind", ["shop_admin", "admin_customer"])
      .order("last_message_at", { ascending: false }),
    supabase.from("shops").select("id, name, logo_url, login_shop_id, verification_status").eq("status", "active").order("name").limit(80),
  ]);
  const withUnread = await attachUnread(supabase, conversations || [], profile.id);
  const active = withUnread.find((row) => row.id === c);
  const { data: messages } = active
    ? await supabase.from("chat_messages").select("*").eq("conversation_id", active.id).order("created_at")
    : { data: [] };
  return (
    <>
      <PageHeader title="Messages" subtitle="Talk with shops. Customer announcements are one-way. Shop-to-shop and customer-to-customer chat is blocked." />
      <ChatClient
        conversations={withUnread}
        messages={messages || []}
        activeId={active?.id || null}
        userId={profile.id}
        shopOptions={shops || []}
        startKind="shop_admin"
        title="Admin inbox"
      />
    </>
  );
}
