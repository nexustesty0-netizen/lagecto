"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDateTime } from "@/lib/format";

export type InboxRow = {
  id: string;
  title: string;
  message: string;
  href?: string | null;
  is_read?: boolean | null;
  created_at: string;
};

export function NotificationInbox({ items }: { items: InboxRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Unable to update notifications.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border px-4 py-2 text-sm"
          onClick={() => void post({ action: "read", ids: items.map((item) => item.id) })}
          disabled={!items.length}
        >
          Mark all read
        </button>
        <button type="button" className="rounded-full border px-4 py-2 text-sm text-red-700" onClick={() => setClearOpen(true)} disabled={!items.length}>
          Clear all
        </button>
      </div>
      {message ? <p className="mb-3 text-sm text-[#0B6E4F]">{message}</p> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="os-surface">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-[var(--lagecto-muted)]">{item.message}</p>
                <p className="mt-1 text-xs text-[var(--lagecto-muted)]">{formatDateTime(item.created_at)}</p>
              </div>
              <button type="button" className="text-sm text-red-700" onClick={() => setPending(item.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Delete this notification?"
        body="It will be removed from this inbox."
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const id = pending;
          setPending(null);
          if (id) void post({ action: "delete", ids: [id] });
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
          void post({ action: "clear" });
        }}
      />
    </div>
  );
}
