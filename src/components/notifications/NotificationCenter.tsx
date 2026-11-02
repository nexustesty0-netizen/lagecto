"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { emitNavBadges, emitNotificationsChanged, NOTIFICATIONS_EVENT } from "@/lib/notifications-events";
import {
  isNoticeUuid,
  noticePreview,
  notificationOpenHref,
  relatedRecordLabel,
  staffMaySeeNotice,
  type NoticeAudience,
  type NoticeRow,
} from "@/lib/notifications";
import {
  parseNoticePrefs,
  readLocalNoticePrefs,
  shouldShowBrowserAlert,
  shouldShowPopup,
  writeLocalNoticePrefs,
} from "@/lib/notification-prefs";
import { markNotificationHeard, playNotificationSound, unlockNotificationAudio, wasNotificationHeard } from "@/lib/notification-sound";
import { formatRelativeTime } from "@/lib/format";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { NotificationIcon } from "@/components/notifications/NotificationIcon";
import { NotificationPrefs } from "@/components/notifications/NotificationPrefs";

export { NotificationPrefs };

type InboxItem = NoticeRow;

const TOAST_LIMIT = 3;

function asItem(row: Record<string, unknown> | InboxItem | null | undefined): InboxItem | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    title: String(row.title || "Update"),
    message: String(row.message || ""),
    type: row.type ? String(row.type) : "general",
    href: row.href ? String(row.href) : null,
    reference_id: row.reference_id ? String(row.reference_id) : null,
    is_read: Boolean(row.is_read),
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

function showBrowserNotice(item: InboxItem, href: string) {
  try {
    const alert = new Notification(item.title, {
      body: noticePreview(item.message),
      icon: "/icon.png",
      tag: item.id,
      silent: true,
    });
    alert.onclick = () => {
      window.focus();
      alert.close();
      window.location.assign(href);
    };
  } catch {
    // Permission or platform limits should never break in-app alerts.
  }
}

export function NotificationCenter() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const audienceRef = useRef<NoticeAudience>("customer");
  const staffRef = useRef<string | null>(null);
  const badgesRef = useRef({ unread: 0, unreadMessages: 0 });
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [home, setHome] = useState("/customer/notifications");
  const [audience, setAudience] = useState<NoticeAudience>("customer");
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<InboxItem[]>([]);
  const [soundHint, setSoundHint] = useState(false);
  const [mounted, setMounted] = useState(false);

  function setBadgeUnread(nextUnread: number) {
    badgesRef.current.unread = Math.max(0, nextUnread);
    setUnread(badgesRef.current.unread);
    emitNavBadges(badgesRef.current);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function markInteracted() {
      unlockNotificationAudio();
      setSoundHint(false);
    }
    window.addEventListener("pointerdown", markInteracted);
    window.addEventListener("keydown", markInteracted);
    return () => {
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createBrowserSupabase> | null = null;
    let channel: ReturnType<ReturnType<typeof createBrowserSupabase>["channel"]> | null = null;

    function arrive(raw: Record<string, unknown>, toast: boolean) {
      const item = asItem(raw);
      if (!item || !staffMaySeeNotice(staffRef.current, item.type)) return;
      const isNew = !seen.current.has(item.id);
      seen.current.add(item.id);
      setItems((current) => {
        const without = current.filter((row) => row.id !== item.id);
        const next = item.is_read ? without : [item, ...without];
        return next.slice(0, 12);
      });
      if (isNew && !item.is_read) setBadgeUnread(badgesRef.current.unread + 1);
      if (!toast || !isNew || item.is_read) return;
      const prefs = readLocalNoticePrefs();
      if (shouldShowPopup(prefs, item.type)) {
        setToasts((current) => [item, ...current.filter((row) => row.id !== item.id)].slice(0, TOAST_LIMIT));
        window.setTimeout(() => {
          setToasts((current) => current.filter((row) => row.id !== item.id));
        }, 6500);
      }
      playNotificationSound(item.id, item.type);
      if (shouldShowBrowserAlert(prefs, item.type) && !wasNotificationHeard(`b:${item.id}`)) {
        markNotificationHeard(`b:${item.id}`);
        showBrowserNotice(item, notificationOpenHref(item, audienceRef.current));
      }
    }

    async function load() {
      const [res, inboxRes] = await Promise.all([
        fetch("/api/notifications", { cache: "no-store" }),
        fetch("/api/chat/inbox", { cache: "no-store" }),
      ]);
      if (!res.ok || cancelled) return null;
      const data = await res.json();
      const next: InboxItem[] = (data.items || []).map(asItem).filter(Boolean) as InboxItem[];
      const nextAudience: NoticeAudience =
        data.audience ||
        (String(data.home || "").startsWith("/shop") ? "shop" : String(data.home || "").startsWith("/admin") ? "admin" : "customer");
      audienceRef.current = nextAudience;
      staffRef.current = data.staffRole || null;
      setHome(data.home || "/customer/notifications");
      setAudience(nextAudience);
      if (data.prefs) writeLocalNoticePrefs(parseNoticePrefs(data.prefs));
      next.forEach((item) => seen.current.add(item.id));
      primed.current = true;
      setItems(next);
      let unreadMessages = 0;
      if (inboxRes.ok) {
        const inbox = await inboxRes.json().catch(() => ({ conversations: [] }));
        unreadMessages = (inbox.conversations || []).reduce(
          (sum: number, row: { unread?: number }) => sum + (Number(row.unread || 0) || 0),
          0,
        );
      }
      badgesRef.current.unreadMessages = unreadMessages;
      setBadgeUnread(Number(data.unread ?? next.length) || 0);
      if (parseNoticePrefs(data.prefs || readLocalNoticePrefs()).sound && window.localStorage.getItem("lg-interacted") !== "1") {
        setSoundHint(true);
      }
      return data as { shopId?: string | null; userId?: string | null };
    }

    try {
      supabase = createBrowserSupabase();
    } catch {
      supabase = null;
    }

    async function start() {
      const snapshot = await load();
      if (cancelled || !supabase || !snapshot) return;
      const nextShopId = snapshot.shopId && isNoticeUuid(snapshot.shopId) ? snapshot.shopId : null;
      const nextUserId = snapshot.userId && isNoticeUuid(snapshot.userId) ? snapshot.userId : null;
      const table = nextShopId ? "shop_notifications" : "notifications";
      const filter = nextShopId ? `shop_id=eq.${nextShopId}` : nextUserId ? `user_id=eq.${nextUserId}` : "";
      if (!filter) return;
      channel = supabase
        .channel(`lagecto-notices-${nextShopId || nextUserId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, (payload) => {
          arrive(payload.new as Record<string, unknown>, primed.current);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, (payload) => {
          const item = asItem(payload.new as Record<string, unknown>);
          if (!item || !staffMaySeeNotice(staffRef.current, item.type)) return;
          setItems((current) => {
            const without = current.filter((row) => row.id !== item.id);
            return item.is_read ? without.slice(0, 12) : [item, ...without].slice(0, 12);
          });
          if (item.is_read) setBadgeUnread(badgesRef.current.unread - 1);
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table, filter }, (payload) => {
          const id = String((payload.old as { id?: string } | null)?.id || "");
          if (!id) return;
          setItems((current) => current.filter((row) => row.id !== id));
        });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    }

    void start();
    const timer = window.setInterval(() => {
      void load();
    }, 20000);
    window.addEventListener(NOTIFICATIONS_EVENT, load);
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function markRead(ids: string[]) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", ids }),
    });
    setItems((current) => current.filter((row) => !ids.includes(row.id)));
    setBadgeUnread(badgesRef.current.unread - ids.length);
    emitNotificationsChanged();
  }

  function openItem(item: InboxItem) {
    setToasts((current) => current.filter((row) => row.id !== item.id));
    setOpen(false);
    void markRead([item.id]);
    router.push(notificationOpenHref(item, audience));
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className={`relative grid h-11 w-11 place-items-center rounded-full border border-[var(--lagecto-border)] bg-white ${unread ? "lg-bell-live" : ""}`}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unread ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#C2413B] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="lg-notice-panel absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--lagecto-border)] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread ? (
              <button
                type="button"
                className="text-xs font-semibold text-[#0B6E4F]"
                onClick={() => {
                  void fetch("/api/notifications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "read_all" }),
                  }).then(() => {
                    setItems([]);
                    setBadgeUnread(0);
                    emitNotificationsChanged();
                  });
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {soundHint ? (
            <p className="border-b border-[var(--lagecto-border)] px-4 py-2 text-xs text-[var(--lagecto-muted)]">
              Tap anywhere to enable notification sounds.
            </p>
          ) : null}
          <div className="max-h-80 overflow-y-auto">
            {!items.length ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--lagecto-muted)]">You are up to date.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-start gap-3 border-b border-[var(--lagecto-border)] px-4 py-3 text-left last:border-0"
                  onClick={() => openItem(item)}
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0B6E4F]/10 text-[#0B6E4F]">
                    <NotificationIcon type={item.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                      {!item.is_read ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#C2413B]" /> : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--lagecto-muted)]">{noticePreview(item.message)}</span>
                    <span className="mt-1 block text-[11px] text-[var(--lagecto-muted)]">{formatRelativeTime(item.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <Link href={home} className="block border-t border-[var(--lagecto-border)] px-4 py-3 text-center text-sm font-semibold text-[#0B6E4F]" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      ) : null}

      {mounted && toasts.length
        ? createPortal(
            <div className="lg-toast-stack">
              {toasts.map((toast) => (
                <article key={toast.id} className="lg-toast os-surface p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0B6E4F] text-white">
                      <NotificationIcon type={toast.type} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{toast.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-[var(--lagecto-muted)]">{noticePreview(toast.message, 110)}</p>
                      <p className="mt-1 text-[11px] text-[var(--lagecto-muted)]">{formatRelativeTime(toast.created_at)}</p>
                      <div className="mt-2 flex justify-end gap-3">
                        <button type="button" className="text-xs" onClick={() => setToasts((current) => current.filter((row) => row.id !== toast.id))}>
                          Dismiss
                        </button>
                        <button type="button" className="text-xs font-semibold text-[#0B6E4F]" onClick={() => openItem(toast)}>
                          {relatedRecordLabel(toast.type)}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--lagecto-muted)]"
                      aria-label="Dismiss notification"
                      onClick={() => setToasts((current) => current.filter((row) => row.id !== toast.id))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
