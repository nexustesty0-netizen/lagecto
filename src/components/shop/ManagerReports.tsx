"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_CATEGORIES } from "@/lib/features";
import { formatDateTime, titleCase } from "@/lib/format";
import { StatusBadge } from "@/components/ui/primitives";

export function ManagerReportForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setError("");
    setOk("");
    const form = new FormData(formEl);
    const res = await fetch("/api/shop/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        category: form.get("category"),
        body: form.get("body"),
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to send this report.");
    else {
      setOk("Report sent to LaGecto admin.");
      formEl.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="os-surface grid gap-3">
      <h2 className="font-semibold">Send a report to admin</h2>
      <input name="title" required placeholder="Title" className="rounded-xl border px-3 py-2" />
      <select name="category" className="rounded-xl border px-3 py-2" defaultValue="operational">
        {REPORT_CATEGORIES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <textarea name="body" required placeholder="What happened?" className="min-h-32 rounded-xl border px-3 py-2" />
      <button className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">Send to admin</button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="text-sm text-[#0B6E4F]">{ok}</p> : null}
    </form>
  );
}

export function ManagerReportList({
  reports,
}: {
  reports: {
    id: string;
    title: string;
    category: string;
    body: string;
    status: string;
    admin_reply?: string | null;
    created_at: string;
    shops?: { name?: string } | { name?: string }[] | null;
  }[];
}) {
  return (
    <div className="grid gap-3">
      {reports.map((report) => {
        const shop = Array.isArray(report.shops) ? report.shops[0] : report.shops;
        return (
          <article key={report.id} className="os-surface">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{report.title}</h3>
              <StatusBadge value={report.status} />
              <span className="text-xs text-[var(--lagecto-muted)]">{titleCase(report.category)}</span>
            </div>
            {shop?.name ? <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{shop.name}</p> : null}
            <p className="mt-2 whitespace-pre-wrap text-sm">{report.body}</p>
            {report.admin_reply ? <p className="mt-3 rounded-xl bg-[#F7F3E3] p-3 text-sm">{report.admin_reply}</p> : null}
            <p className="mt-2 text-xs text-[var(--lagecto-muted)]">{formatDateTime(report.created_at)}</p>
          </article>
        );
      })}
    </div>
  );
}

export function AdminReportActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function call(payload: Record<string, unknown>) {
    setError("");
    const res = await fetch("/api/admin/manager-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to update this report.");
    else router.refresh();
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <button type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => call({ status: "read" })}>
            Mark read
          </button>
        ) : null}
        <button type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => call({ status: "in_progress" })}>
          In progress
        </button>
        <button type="button" className="rounded-full border px-3 py-1 text-sm" onClick={() => call({ status: "archived" })}>
          Archive
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          call({ reply: form.get("reply") });
          event.currentTarget.reset();
        }}
        className="grid gap-2"
      >
        <textarea name="reply" placeholder="Reply to the shop" className="min-h-20 rounded-xl border px-3 py-2 text-sm" />
        <button className="rounded-full bg-[#0B6E4F] px-3 py-1.5 text-sm text-white">Send reply</button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
