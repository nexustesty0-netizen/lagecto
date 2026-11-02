import type { createServerSupabase } from "@/lib/supabase/server";
import {
  asUuid,
  inboxFallbackName,
  publicDisplayName,
  sanitizeInboxItem,
  type ChatView,
} from "@/lib/chat-privacy";

export type ChatInboxItem = ReturnType<typeof sanitizeInboxItem>;

export type ChatMessageView = {
  id: string;
  body: string;
  created_at: string;
  is_system: boolean;
  mine: boolean;
};

type ServerClient = Awaited<ReturnType<typeof createServerSupabase>>;

function parseInbox(data: unknown, view: ChatView): ChatInboxItem[] {
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const kind = String(item.kind || "");
      return sanitizeInboxItem(item, inboxFallbackName(view, kind));
    })
    .filter((row) => asUuid(row.id));
}

function mapMessages(
  rows: Array<{ id: string; body: string; created_at: string; is_system?: boolean | null; sender_id?: string | null }>,
  userId: string,
): ChatMessageView[] {
  return rows.map((row) => ({
    id: row.id,
    body: String(row.body || ""),
    created_at: row.created_at,
    is_system: Boolean(row.is_system),
    mine: row.sender_id === userId && !row.is_system,
  }));
}

export async function loadChatInbox(supabase: ServerClient, view: ChatView, userId: string): Promise<ChatInboxItem[]> {
  const { data, error } = await supabase.rpc("chat_inbox", { p_view: view });
  if (!error) return parseInbox(data, view);

  let query = supabase
    .from("chat_conversations")
    .select("id, kind, can_reply, last_message_at, last_message_preview, shops(name, logo_url)")
    .order("last_message_at", { ascending: false });

  if (view === "customer") query = query.eq("customer_id", userId).in("kind", ["shop_customer", "admin_customer"]);
  else if (view === "shop") query = query.in("kind", ["shop_customer", "shop_admin"]);
  else query = query.in("kind", ["shop_admin", "admin_customer"]);

  const { data: rows } = await query;
  type FallbackRow = {
    id: string;
    kind: string | null;
    can_reply?: boolean | null;
    last_message_at?: string | null;
    last_message_preview?: string | null;
    unread?: number;
    shops?: { name?: string | null; logo_url?: string | null } | { name?: string | null; logo_url?: string | null }[] | null;
  };
  const withUnread = await attachUnread(supabase, (rows || []) as FallbackRow[], userId);
  return withUnread.map((row) => {
    const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
    const kind = String(row.kind || "");
    const peer =
      view === "customer" || (view === "admin" && kind === "shop_admin")
        ? publicDisplayName(shop?.name, inboxFallbackName(view, kind))
        : inboxFallbackName(view, kind);
    return sanitizeInboxItem(
      {
        id: row.id,
        kind,
        can_reply: row.can_reply,
        last_message_at: row.last_message_at,
        last_message_preview: row.last_message_preview,
        product_name: null,
        product_image: null,
        peer_name: peer,
        peer_photo: shop?.logo_url,
        unread: row.unread,
      },
      peer,
    );
  });
}

export async function loadChatMessages(supabase: ServerClient, conversationId: string, userId: string): Promise<ChatMessageView[]> {
  const id = asUuid(conversationId);
  if (!id) return [];
  const { data } = await supabase
    .from("chat_messages")
    .select("id, body, created_at, is_system, sender_id")
    .eq("conversation_id", id)
    .order("created_at");
  return mapMessages(data || [], userId);
}

export async function attachUnread<T extends { id: string }>(
  supabase: ServerClient,
  conversations: T[],
  userId: string,
) {
  const ids = conversations.map((row) => row.id);
  if (!ids.length) return conversations.map((row) => ({ ...row, unread: 0 }));
  const [{ data: reads }, { data: messages }] = await Promise.all([
    supabase.from("chat_reads").select("conversation_id, last_read_at").eq("user_id", userId).in("conversation_id", ids),
    supabase.from("chat_messages").select("conversation_id, created_at, sender_id").in("conversation_id", ids),
  ]);
  const lastRead = Object.fromEntries((reads || []).map((row) => [row.conversation_id, row.last_read_at]));
  return conversations.map((conversation) => ({
    ...conversation,
    unread: (messages || []).filter(
      (message) =>
        message.conversation_id === conversation.id &&
        message.sender_id !== userId &&
        (!lastRead[conversation.id] || message.created_at > lastRead[conversation.id]),
    ).length,
  }));
}
