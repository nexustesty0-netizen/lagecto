import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { ChatClient } from "@/components/chat/ChatClient";
import { loadChatInbox, loadChatMessages } from "@/lib/chat";
import { asUuid, publicDisplayName } from "@/lib/chat-privacy";

export default async function AdminChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const profile = await requireAdminLevel("super_admin");
  const { c } = await searchParams;
  const supabase = await createServerSupabase();
  const [{ data: shops }, conversations] = await Promise.all([
    supabase.from("shops").select("id, name, logo_url, verification_status").eq("status", "active").order("name").limit(400),
    loadChatInbox(supabase, "admin", profile.id),
  ]);
  const activeId = conversations.some((row) => row.id === asUuid(c)) ? asUuid(c) : null;
  const messages = activeId ? await loadChatMessages(supabase, activeId, profile.id) : [];
  const shopOptions = (shops || []).map((shop) => ({
    id: shop.id,
    name: publicDisplayName(shop.name, "Shop"),
    logo_url: shop.logo_url,
    verified: shop.verification_status === "verified",
  }));
  return (
    <>
      <PageHeader title="Shop support" subtitle="Message a shop from the directory. Support threads stay between LaGecto and that shop." />
      <ChatClient
        conversations={conversations}
        messages={messages}
        activeId={activeId}
        userId={profile.id}
        view="admin"
        basePath="/admin/chat"
        shopOptions={shopOptions}
        title="Support inbox"
        emptyHint="Find a shop in the directory to open or start its LaGecto support conversation."
      />
    </>
  );
}
