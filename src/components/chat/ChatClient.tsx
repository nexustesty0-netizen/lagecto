"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InitialsAvatar } from "@/components/os/OsUi";
import { formatDateTime } from "@/lib/format";

type ShopPreview = { name?: string | null; logo_url?: string | null; login_shop_id?: string | null; verification_status?: string | null };

type Conversation = {
  id: string;
  kind: string;
  shop_id: string | null;
  customer_id: string | null;
  can_reply?: boolean | null;
  title?: string | null;
  created_at: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread?: number | null;
  shops?: ShopPreview | ShopPreview[] | null;
};

type Message = {
  id: string;
  body: string;
  sender_id: string | null;
  created_at: string;
  is_system?: boolean | null;
};

function shopOf(conversation: Conversation): ShopPreview | null {
  const value = conversation.shops;
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export function ChatClient({
  conversations,
  messages,
  activeId,
  userId,
  shopOptions,
  startKind,
  canStartShopAdmin,
  title = "Conversations",
  privacyNote = "Messages are protected with transport encryption, signed-in access checks, and role permissions. They are not end-to-end encrypted.",
}: {
  conversations: Conversation[];
  messages: Message[];
  activeId: string | null;
  userId: string;
  shopOptions?: { id: string; name: string; logo_url?: string | null; login_shop_id?: string | null; verification_status?: string | null }[];
  startKind?: "shop_customer" | "shop_admin" | "admin_customer";
  canStartShopAdmin?: boolean;
  title?: string;
  privacyNote?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const active = conversations.find((row) => row.id === activeId);
  const canReply = active ? active.kind !== "admin_customer" && active.can_reply !== false : false;
  const shop = active ? shopOf(active) : null;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeId]);

  useEffect(() => {
    if (!activeId) return;
    void fetch("/api/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeId }),
    });
  }, [activeId, messages.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((row) => {
      const shopName = shopOf(row)?.name || "";
      return `${row.title || ""} ${shopName} ${row.last_message_preview || ""}`.toLowerCase().includes(q);
    });
  }, [conversations, query]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim()) return;
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: activeId, body: draft }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to send this message.");
    else {
      setDraft("");
      router.refresh();
    }
  }

  async function start(kind: string, shopId?: string, customerId?: string) {
    const res = await fetch("/api/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, shopId, customerId }),
    });
    const data = await res.json();
    if (data.conversation_id) router.push(`?c=${data.conversation_id}`);
    else setError(data.error || "Unable to start this chat.");
  }

  return (
    <div className="lg-chat os-surface grid overflow-hidden p-0 lg:grid-cols-[300px_1fr]">
      <aside className="border-b border-[var(--lagecto-border)] lg:border-b-0 lg:border-r">
        <div className="p-3">
          <p className="mb-2 text-sm font-semibold">{title}</p>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" className="mb-3 w-full rounded-xl border px-3 py-2 text-sm" />
          {shopOptions?.length && startKind === "shop_admin" ? (
            <select className="mb-3 w-full rounded-xl border px-3 py-2 text-sm" defaultValue="" onChange={(event) => event.target.value && void start("shop_admin", event.target.value)}>
              <option value="">Message a shop…</option>
              {shopOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.login_shop_id ? ` · ${option.login_shop_id}` : ""}
                </option>
              ))}
            </select>
          ) : null}
          {canStartShopAdmin ? (
            <button type="button" className="mb-3 w-full rounded-xl border px-3 py-2 text-sm" onClick={() => void start("shop_admin")}>
              Message LaGecto
            </button>
          ) : null}
        </div>
        <div className="grid max-h-[40vh] gap-1 overflow-y-auto px-2 pb-3 lg:max-h-[calc(70vh-8rem)]">
          {!filtered.length ? <p className="px-3 py-6 text-sm text-[var(--lagecto-muted)]">No conversations yet.</p> : null}
          {filtered.map((conversation) => {
            const preview = shopOf(conversation);
            return (
              <a
                key={conversation.id}
                href={`?c=${conversation.id}`}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${activeId === conversation.id ? "bg-[#0B6E4F] text-white" : "hover:bg-[#0B6E4F]/8"}`}
              >
                <InitialsAvatar name={preview?.name || conversation.title} photoUrl={preview?.logo_url} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{preview?.name || conversation.title || conversation.kind.replace("_", " ")}</span>
                    {conversation.unread ? (
                      <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] ${activeId === conversation.id ? "bg-white text-[#0B6E4F]" : "bg-[#0B6E4F] text-white"}`}>
                        {conversation.unread}
                      </span>
                    ) : null}
                  </span>
                  <span className={`block truncate text-xs ${activeId === conversation.id ? "text-white/80" : "text-[var(--lagecto-muted)]"}`}>
                    {conversation.last_message_preview || "No messages yet"}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </aside>
      <section className="flex min-h-[420px] flex-col">
        {!activeId ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <p className="font-semibold">Choose a conversation</p>
            <p className="mt-2 max-w-sm text-sm text-[var(--lagecto-muted)]">Open a shop from the marketplace and tap Message shop to start.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--lagecto-border)] px-4 py-3">
              <InitialsAvatar name={shop?.name || active?.title} photoUrl={shop?.logo_url} size={40} />
              <div>
                <p className="font-semibold">{shop?.name || active?.title || "Conversation"}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">
                  {shop?.login_shop_id || (active?.kind === "admin_customer" ? "LaGecto announcement" : "LaGecto chat")}
                  {shop?.verification_status === "verified" ? " · Verified" : ""}
                </p>
              </div>
            </header>
            {active?.kind === "admin_customer" ? (
              <p className="bg-[#F7F3E3] px-4 py-2 text-sm">This is a LaGecto announcement. Replies are not available. Use Help if you need support.</p>
            ) : null}
            <div className="lg-chat-thread flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((message) => {
                const mine = message.sender_id === userId;
                return (
                  <article key={message.id} className={`max-w-[85%] px-3 py-2 text-sm ${mine ? "lg-bubble-out ml-auto" : "lg-bubble-in"}`}>
                    {message.is_system ? <p className="mb-1 text-[11px] uppercase tracking-wide opacity-70">Announcement</p> : null}
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-[var(--lagecto-muted)]"}`}>{formatDateTime(message.created_at)}</p>
                  </article>
                );
              })}
              <div ref={bottom} />
            </div>
            {canReply ? (
              <form onSubmit={send} className="flex items-end gap-2 border-t border-[var(--lagecto-border)] p-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  required
                  rows={1}
                  placeholder="Message"
                  className="min-h-11 flex-1 resize-none rounded-2xl border px-3 py-2"
                />
                <button className="min-h-11 rounded-full bg-[#0B6E4F] px-4 py-2 text-white">Send</button>
              </form>
            ) : (
              <p className="border-t border-[var(--lagecto-border)] px-4 py-3 text-sm text-[var(--lagecto-muted)]">You can read this thread, but you cannot reply here.</p>
            )}
            {error ? <p className="px-4 pb-3 text-sm text-red-700">{error}</p> : null}
            <p className="px-4 pb-3 text-[11px] leading-5 text-[var(--lagecto-muted)]">{privacyNote}</p>
          </>
        )}
      </section>
    </div>
  );
}
