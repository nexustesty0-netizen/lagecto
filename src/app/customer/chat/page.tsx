import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { ChatClient } from "@/components/chat/ChatClient";
import { loadChatInbox, loadChatMessages } from "@/lib/chat";
import { asUuid } from "@/lib/chat-privacy";

export default async function CustomerChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const profile = await requireRole("customer");
  const { c } = await searchParams;
  const supabase = await createServerSupabase();
  const conversations = await loadChatInbox(supabase, "customer", profile.id);
  const activeId = conversations.some((row) => row.id === asUuid(c)) ? asUuid(c) : null;
  const messages = activeId ? await loadChatMessages(supabase, activeId, profile.id) : [];
  return (
    <>
      <PageHeader title="My chats" subtitle="Message shops from a shop or product page. You can only see your own conversations." />
      <ChatClient
        conversations={conversations}
        messages={messages}
        activeId={activeId}
        userId={profile.id}
        view="customer"
        basePath="/customer/chat"
        title="My chats"
        emptyHint="Open a shop or product page and tap Message to start an enquiry."
      />
    </>
  );
}
