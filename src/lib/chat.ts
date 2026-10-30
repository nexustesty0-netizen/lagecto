export async function attachUnread<T extends { id: string }>(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerSupabase>>,
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
