import { createServerSupabase } from "@/lib/supabase/server";
import { loadOwnedShopWithFeatures, featureLockReason } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { ChatClient } from "@/components/chat/ChatClient";
import { attachUnread } from "@/lib/chat";

export default async function ShopChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { shop, features, disabledFeatures, profile } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "customer_chat");
  if (locked) return <FeatureLocked feature="customer_chat" reason={locked} />;
  const { c } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: conversations } = await supabase
    .from("chat_conversations")
    .select("id, kind, shop_id, customer_id, can_reply, title, created_at, last_message_at, last_message_preview, shops(name, logo_url, login_shop_id, verification_status)")
    .eq("shop_id", shop.id)
    .in("kind", ["shop_customer", "shop_admin"])
    .order("last_message_at", { ascending: false });
  const withUnread = await attachUnread(supabase, conversations || [], profile.id);
  const active = withUnread.find((row) => row.id === c);
  const { data: messages } = active
    ? await supabase.from("chat_messages").select("*").eq("conversation_id", active.id).order("created_at")
    : { data: [] };
  return (
    <>
      <PageHeader title="Messages" subtitle="Only conversations for this shop. You cannot see other shops’ chats." />
      <ChatClient
        conversations={withUnread}
        messages={messages || []}
        activeId={active?.id || null}
        userId={profile.id}
        canStartShopAdmin
        title="Inbox"
      />
    </>
  );
}
