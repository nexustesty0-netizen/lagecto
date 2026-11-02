import { createServerSupabase } from "@/lib/supabase/server";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { ChatClient } from "@/components/chat/ChatClient";
import { loadChatInbox, loadChatMessages } from "@/lib/chat";
import { asUuid } from "@/lib/chat-privacy";
import { staffCanManage } from "@/lib/shop/staff";

export default async function ShopChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { shop, profile, staffRole } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const { c } = await searchParams;
  const supabase = await createServerSupabase();
  const conversations = await loadChatInbox(supabase, "shop", profile.id);
  const activeId = conversations.some((row) => row.id === asUuid(c)) ? asUuid(c) : null;
  const messages = activeId ? await loadChatMessages(supabase, activeId, profile.id) : [];
  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Customer enquiries and LaGecto support for this shop only. Other shops’ conversations stay private."
      />
      <ChatClient
        conversations={conversations}
        messages={messages}
        activeId={activeId}
        userId={profile.id}
        view="shop"
        basePath="/shop/chat"
        canStartShopAdmin={staffCanManage(staffRole)}
        title="Inbox"
        emptyHint="When a customer messages this shop, the conversation appears here. Use Message LaGecto for support."
      />
    </>
  );
}
