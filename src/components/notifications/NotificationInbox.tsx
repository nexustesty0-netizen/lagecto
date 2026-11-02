"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { emitNotificationsChanged } from "@/lib/notifications-events";
import {
  NOTICE_CATEGORIES,
  NOTICE_FILTERS,
  noticeCategory,
  noticePreview,
  notificationOpenHref,
  type NoticeAudience,
  type NoticeRow,
} from "@/lib/notifications";
import { NotificationIcon } from "@/components/notifications/NotificationIcon";

export type InboxRow = NoticeRow;

export function NotificationInbox({
  items,
  audience,
  nextHref,
  prevHref,
}: {
  items: InboxRow[];
  audience: NoticeAudience;
  nextHref?: string | null;
  prevHref?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [pending, setPending] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<(typeof NOTICE_FILTERS)[number]["id"]>("all");
  const [category, setCategory] = useState<(typeof NOTICE_CATEGORIES)[number]["id"]>("all");

  useEffect(() => {
    setRows(items);
  }, [items]);

  async function post(body: Record<string, unknown>, nextRows?: InboxRow[]) {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "Unable to update notifications.");
      return false;
    }
    if (nextRows) setRows(nextRows);
    emitNotificationsChanged();
    router.refresh();
    return true;
  }

  const visible = useMemo(() => {
    return rows.filter((item) => {
      if (status === "unread" && item.is_read) return false;
      if (status === "read" && !item.is_read) return false;
      if (category !== "all" && noticeCategory(item.type) !== category) return false;
      return true;
    });
  }, [rows, status, category]);

  const unread = rows.filter((item) => !item.is_read).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {NOTICE_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${status === item.id ? "border-[#0B6E4F] bg-[#0B6E4F] text-white" : ""}`}
            onClick={() => setStatus(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {NOTICE_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs ${category === item.id ? "border-[#0B6E4F] text-[#0B6E4F]" : "text-[var(--lagecto-muted)]"}`}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border px-4 py-2 text-sm"
          onClick={() =>
            void post(
              { action: "read_all" },
              rows.map((item) => ({ ...item, is_read: true })),
            )
          }
          disabled={!unread}
        >
          Mark all read
        </button>
        <button type="button" className="rounded-full border px-4 py-2 text-sm text-red-700" onClick={() => setClearOpen(true)} disabled={!rows.length}>
          Clear all
        </button>
      </div>
      {message ? <p className="mb-3 text-sm text-[#C2413B]">{message}</p> : null}
      {!visible.length ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-[var(--lagecto-muted)]">
          {rows.length ? "No notifications in this filter." : "New messages and updates will appear here."}
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => (
            <article key={item.id} className={`os-surface ${item.is_read ? "lg-notice-read" : "lg-notice-unread"}`}>
              <div className="flex items-start justify-between gap-3">
                <Link href={notificationOpenHref(item, audience)} className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0B6E4F]/10 text-[#0B6E4F]">
                    <NotificationIcon type={item.type} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.title}</p>
                      {!item.is_read ? (
                        <span className="rounded-full bg-[#C2413B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Unread
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--lagecto-muted)]">Read</span>
                      )}
                    </span>
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--lagecto-muted)]">{noticePreview(item.message, 180)}</p>
                    <p className="mt-1 text-xs text-[var(--lagecto-muted)]" title={formatDateTime(item.created_at)}>
                      {formatRelativeTime(item.created_at)}
                    </p>
                    <span className="mt-2 inline-block text-sm font-semibold text-[#0B6E4F]">View</span>
                  </span>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {!item.is_read ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-[#0B6E4F]"
                      onClick={() =>
                        void post(
                          { action: "read", ids: [item.id] },
                          rows.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)),
                        )
                      }
                    >
                      Mark read
                    </button>
                  ) : null}
                  <button type="button" className="text-sm text-red-700" onClick={() => setPending(item.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {prevHref || nextHref ? (
        <div className="mt-4 flex justify-between gap-3 text-sm font-semibold text-[#0B6E4F]">
          {prevHref ? <Link href={prevHref}>Newer</Link> : <span />}
          {nextHref ? <Link href={nextHref}>Older</Link> : <span />}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this notification?"
        body="It will be removed from this inbox."
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const id = pending;
          setPending(null);
          if (id) void post({ action: "delete", ids: [id] }, rows.filter((row) => row.id !== id));
        }}
      />
      <ConfirmDialog
        open={clearOpen}
        title="Clear all notifications?"
        body="Every notification in this inbox will be deleted."
        confirmLabel="Clear all"
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          void post({ action: "clear" }, []);
        }}
      />
    </div>
  );
}
