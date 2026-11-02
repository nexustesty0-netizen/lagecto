"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InitialsAvatar } from "@/components/os/OsUi";
import { formatDateTime } from "@/lib/format";
import type { ChatInboxItem, ChatMessageView } from "@/lib/chat";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { asUuid, publicDisplayName } from "@/lib/chat-privacy";

type Delivery = "sent" | "sending" | "failed";

type ThreadMessage = ChatMessageView & { delivery?: Delivery };

type ShopOption = { id: string; name: string; logo_url?: string | null; verified?: boolean };

function kindLabel(kind: string, view: "customer" | "shop" | "admin") {
  if (kind === "shop_admin") return view === "admin" ? "Shop support" : "LaGecto support";
  if (kind === "admin_customer") return "Announcement";
  return view === "customer" ? "Shop" : "Customer";
}

export function ChatClient({
  conversations,
  messages,
  activeId,
  userId,
  view,
  basePath,
  shopOptions,
  canStartShopAdmin,
  title = "Conversations",
  emptyHint,
  privacyNote = "Messages stay inside LaGecto. Names are shown instead of email addresses. This chat is not end-to-end encrypted.",
}: {
  conversations: ChatInboxItem[];
  messages: ChatMessageView[];
  activeId: string | null;
  userId: string;
  view: "customer" | "shop" | "admin";
  basePath: string;
  shopOptions?: ShopOption[];
  canStartShopAdmin?: boolean;
  title?: string;
  emptyHint?: string;
  privacyNote?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [shopQuery, setShopQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threads, setThreads] = useState(conversations);
  const [thread, setThread] = useState<ThreadMessage[]>(messages);
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set(messages.map((row) => row.id)));
  const active = threads.find((row) => row.id === activeId) || null;
  const canReply = Boolean(active && active.kind !== "admin_customer" && active.can_reply);

  useEffect(() => {
    setThreads(conversations);
  }, [conversations]);

  useEffect(() => {
    seenIds.current = new Set(messages.map((row) => row.id));
    setThread(messages);
  }, [activeId, messages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.length, activeId]);

  const refreshInbox = useCallback(async () => {
    const res = await fetch(`/api/chat/inbox?view=${view}`);
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.conversations)) setThreads(data.conversations);
  }, [view]);

  const markRead = useCallback(async (conversationId: string) => {
    await fetch("/api/chat/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    setThreads((current) => current.map((row) => (row.id === conversationId ? { ...row, unread: 0 } : row)));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void markRead(activeId);
  }, [activeId, thread.length, markRead]);

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch {
      return;
    }
    const conversationId = asUuid(activeId);
    let channel = supabase
      .channel(`lagecto-chat-${userId}-${conversationId || "inbox"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => {
        void refreshInbox();
      });
    if (conversationId) {
      channel = channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { id?: string; conversation_id?: string; body?: string; created_at?: string; is_system?: boolean; sender_id?: string | null };
          if (!row.id || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          if (row.conversation_id !== conversationId) return;
          setThread((current) => {
            if (current.some((item) => item.id === row.id)) return current;
            return [
              ...current,
              {
                id: row.id!,
                body: String(row.body || ""),
                created_at: String(row.created_at || new Date().toISOString()),
                is_system: Boolean(row.is_system),
                mine: row.sender_id === userId && !row.is_system,
                delivery: "sent",
              },
            ];
          });
        },
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, refreshInbox, userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((row) => `${row.peer_name} ${row.last_message_preview || ""} ${row.product_name || ""}`.toLowerCase().includes(q));
  }, [threads, query]);

  const filteredShops = useMemo(() => {
    const q = shopQuery.trim().toLowerCase();
    const rows = shopOptions || [];
    if (!q) return rows.slice(0, 12);
    return rows.filter((row) => row.name.toLowerCase().includes(q)).slice(0, 12);
  }, [shopOptions, shopQuery]);

  async function loadThread() {
    if (!activeId) return;
    setLoadingThread(true);
    setError("");
    const res = await fetch(`/api/chat/messages?c=${activeId}`);
    const data = await res.json().catch(() => ({}));
    setLoadingThread(false);
    if (!res.ok) {
      setError(data.error || "Unable to load this conversation.");
      return;
    }
    if (Array.isArray(data.messages)) {
      seenIds.current = new Set(data.messages.map((row: ChatMessageView) => row.id));
      setThread(data.messages);
    }
  }

  async function send(event?: React.FormEvent<HTMLFormElement>, text?: string) {
    event?.preventDefault();
    const body = (text ?? draft).trim().slice(0, 4000);
    if (!activeId || !body || sending.current || !canReply) return;
    const tempId = `pending-${Date.now()}`;
    sending.current = true;
    setBusy(true);
    setError("");
    setDraft("");
    setThread((current) => [
      ...current,
      { id: tempId, body, created_at: new Date().toISOString(), is_system: false, mine: true, delivery: "sending" },
    ]);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setThread((current) => current.map((row) => (row.id === tempId ? { ...row, delivery: "failed" } : row)));
        setDraft(body);
        setError(data.error || "Unable to send this message.");
      } else if (data.message_id) {
        seenIds.current.add(data.message_id);
        setThread((current) =>
          current.map((row) =>
            row.id === tempId
              ? { ...row, id: data.message_id, created_at: data.created_at || row.created_at, delivery: "sent" }
              : row,
          ),
        );
        setThreads((current) =>
          current.map((row) =>
            row.id === activeId ? { ...row, last_message_preview: body.slice(0, 80), last_message_at: data.created_at || row.last_message_at } : row,
          ),
        );
      }
    } catch {
      setThread((current) => current.map((row) => (row.id === tempId ? { ...row, delivery: "failed" } : row)));
      setDraft(body);
      setError("Unable to send this message.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function retry(message: ThreadMessage) {
    if (message.delivery !== "failed" || sending.current) return;
    setThread((current) => current.filter((row) => row.id !== message.id));
    await send(undefined, message.body);
  }

  async function start(kind: string, shopId?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, shopId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.conversation_id) router.push(`${basePath}?c=${data.conversation_id}`);
    else setError(data.error || "Unable to start this chat.");
  }

  const defaultEmpty =
    view === "shop"
      ? "Customer enquiries appear here. Use Message LaGecto for support."
      : view === "admin"
        ? "Choose a shop to open or start a support conversation."
        : "Open a shop or product page and tap Message to start.";

  return (
    <div className="lg-chat os-surface grid overflow-hidden p-0 lg:grid-cols-[minmax(17rem,20rem)_1fr]">
      <aside className={`border-[var(--lagecto-border)] ${activeId ? "hidden lg:block lg:border-r" : "border-b lg:border-b-0 lg:border-r"}`}>
        <div className="p-4">
          <p className="text-sm font-semibold">{title}</p>
          <label className="mt-3 block">
            <span className="sr-only">Search conversations</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="w-full rounded-xl border border-[var(--lagecto-border)] bg-white px-3 py-2 text-sm"
            />
          </label>
          {canStartShopAdmin ? (
            <button type="button" disabled={busy} className="mt-3 w-full rounded-xl border border-[var(--lagecto-border)] px-3 py-2 text-sm font-medium" onClick={() => void start("shop_admin")}>
              {busy ? "Opening…" : "Message LaGecto"}
            </button>
          ) : null}
          {shopOptions?.length ? (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Shops</p>
              <input
                value={shopQuery}
                onChange={(event) => setShopQuery(event.target.value)}
                placeholder="Find a shop"
                className="mb-2 w-full rounded-xl border border-[var(--lagecto-border)] bg-white px-3 py-2 text-sm"
              />
              <div className="grid max-h-40 gap-1 overflow-y-auto">
                {filteredShops.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void start("shop_admin", option.id)}
                    className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-[#0B6E4F]/8"
                  >
                    <InitialsAvatar name={publicDisplayName(option.name, "Shop")} photoUrl={option.logo_url} size={28} />
                    <span className="truncate">{publicDisplayName(option.name, "Shop")}</span>
                  </button>
                ))}
                {!filteredShops.length ? <p className="px-2 py-2 text-xs text-[var(--lagecto-muted)]">No matching shop.</p> : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid max-h-[48vh] gap-1 overflow-y-auto px-2 pb-3 lg:max-h-[calc(70vh-9rem)]">
          {!filtered.length ? <p className="px-3 py-8 text-sm text-[var(--lagecto-muted)]">No conversations yet.</p> : null}
          {filtered.map((conversation) => {
            const selected = activeId === conversation.id;
            return (
              <a
                key={conversation.id}
                href={`${basePath}?c=${conversation.id}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${selected ? "bg-[#0B6E4F] text-white" : "hover:bg-[#0B6E4F]/8"}`}
              >
                <InitialsAvatar name={conversation.peer_name} photoUrl={conversation.peer_photo} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{conversation.peer_name}</span>
                    {conversation.unread ? (
                      <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold ${selected ? "bg-white text-[#0B6E4F]" : "bg-[#0B6E4F] text-white"}`}>
                        {conversation.unread > 9 ? "9+" : conversation.unread}
                      </span>
                    ) : null}
                  </span>
                  <span className={`block truncate text-xs ${selected ? "text-white/80" : "text-[var(--lagecto-muted)]"}`}>
                    {conversation.product_name ? `${conversation.product_name} · ` : ""}
                    {conversation.last_message_preview || "No messages yet"}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </aside>
      <section className={`flex min-h-[420px] flex-col ${activeId ? "" : "hidden lg:flex"}`}>
        {!activeId ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <p className="font-semibold">Choose a conversation</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--lagecto-muted)]">{emptyHint || defaultEmpty}</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--lagecto-border)] px-4 py-3">
              <a href={basePath} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--lagecto-border)] text-sm lg:hidden">
                ←
              </a>
              <InitialsAvatar name={active?.peer_name} photoUrl={active?.peer_photo} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{active?.peer_name || "Conversation"}</p>
                <p className="text-xs text-[var(--lagecto-muted)]">{kindLabel(active?.kind || "", view)}</p>
              </div>
            </header>
            {active?.product_name ? (
              <div className="flex items-center gap-3 border-b border-[var(--lagecto-border)] bg-[#f7f3e8] px-4 py-3">
                {active.product_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.product_image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lagecto-muted)]">Product enquiry</p>
                  <p className="truncate text-sm font-medium">{active.product_name}</p>
                </div>
              </div>
            ) : null}
            {active?.kind === "admin_customer" ? (
              <p className="bg-[#F7F3E3] px-4 py-2 text-sm">This is a LaGecto announcement. Replies are not available.</p>
            ) : null}
            <div className="lg-chat-thread flex-1 space-y-2 overflow-y-auto p-4">
              {loadingThread ? <p className="text-center text-sm text-[var(--lagecto-muted)]">Loading messages…</p> : null}
              {!thread.length && !loadingThread ? (
                <p className="py-10 text-center text-sm text-[var(--lagecto-muted)]">No messages yet. Write the first one below.</p>
              ) : null}
              {thread.map((message) => {
                if (message.is_system) {
                  return (
                    <p key={message.id} className="mx-auto max-w-[90%] rounded-xl bg-white/70 px-3 py-2 text-center text-xs leading-5 text-[var(--lagecto-muted)]">
                      {message.body}
                    </p>
                  );
                }
                return (
                  <article
                    key={message.id}
                    className={`max-w-[85%] px-3 py-2 text-sm ${message.mine ? "lg-bubble-out ml-auto" : "lg-bubble-in"} ${message.delivery === "sending" ? "opacity-70" : ""}`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p className={`mt-1 text-[11px] ${message.mine ? "text-white/70" : "text-[var(--lagecto-muted)]"}`}>
                      {formatDateTime(message.created_at)}
                      {message.delivery === "sending" ? " · Sending" : ""}
                      {message.delivery === "sent" && message.mine ? " · Sent" : ""}
                      {message.delivery === "failed" ? " · Not sent" : ""}
                    </p>
                    {message.delivery === "failed" ? (
                      <button type="button" className="mt-1 text-[11px] underline" onClick={() => void retry(message)}>
                        Retry
                      </button>
                    ) : null}
                  </article>
                );
              })}
              <div ref={bottom} />
            </div>
            {canReply ? (
              <form onSubmit={(event) => void send(event)} className="flex items-end gap-2 border-t border-[var(--lagecto-border)] p-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  required
                  rows={1}
                  placeholder="Write a message"
                  className="min-h-11 flex-1 resize-none rounded-2xl border border-[var(--lagecto-border)] px-3 py-2"
                />
                <button disabled={busy || !draft.trim()} className="min-h-11 rounded-full bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-50">
                  {busy ? "Sending" : "Send"}
                </button>
              </form>
            ) : (
              <p className="border-t border-[var(--lagecto-border)] px-4 py-3 text-sm text-[var(--lagecto-muted)]">You can read this thread, but you cannot reply here.</p>
            )}
            {error ? (
              <div className="flex items-center justify-between gap-3 px-4 pb-2 text-sm text-red-700">
                <p>{error}</p>
                <button type="button" className="underline" onClick={() => void loadThread()}>
                  Retry
                </button>
              </div>
            ) : null}
            <p className="px-4 pb-3 text-[11px] leading-5 text-[var(--lagecto-muted)]">{privacyNote}</p>
          </>
        )}
      </section>
    </div>
  );
}
