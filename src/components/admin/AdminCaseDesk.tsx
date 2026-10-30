"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusesForKind } from "@/lib/support/constants";

export function AdminCaseDesk({
  ticket,
  similar,
}: {
  ticket: {
    id: string;
    ticket_number: string;
    kind: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    severity?: string | null;
    area?: string | null;
    steps_to_reproduce?: string | null;
    rating?: number | null;
    shop_id?: string | null;
    order_number?: string | null;
    assigned_to?: string | null;
    duplicate_of?: string | null;
    reporter_user_id: string;
    attachments?: { path?: string }[] | null;
  };
  similar?: { id: string; ticket_number: string; subject: string; status: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const statuses = statusesForKind(ticket.kind);

  async function post(payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to save.");
    else {
      setError("");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4">
      <form
        className="lg-card grid gap-3 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void post({
            action: "update_case",
            caseId: ticket.id,
            status: form.get("status"),
            priority: form.get("priority"),
            severity: form.get("severity"),
            assignedTo: form.get("assigned_to"),
            duplicateOf: form.get("duplicate_of"),
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Status
            <select name="status" defaultValue={ticket.status} className="mt-1 w-full rounded-xl border px-3 py-2">
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Priority
            <select name="priority" defaultValue={ticket.priority} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          {ticket.kind === "bug" ? (
            <label className="text-sm">
              Severity
              <select name="severity" defaultValue={ticket.severity || "moderate"} className="mt-1 w-full rounded-xl border px-3 py-2">
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="major">Major</option>
                <option value="blocking">Blocking</option>
              </select>
            </label>
          ) : null}
          <label className="text-sm">
            Assign to (user UUID)
            <input name="assigned_to" defaultValue={ticket.assigned_to || ""} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
        </div>
        {ticket.kind === "bug" ? (
          <label className="text-sm">
            Link duplicate of (case UUID — does not merge)
            <input name="duplicate_of" defaultValue={ticket.duplicate_of || ""} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save case</button>
      </form>

      {similar?.length ? (
        <section className="lg-card p-5">
          <h2 className="font-semibold">Possible duplicates</h2>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">Similar title, description or area. Confirm before linking — nothing is merged automatically.</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {similar.map((row) => (
              <li key={row.id}>
                <a className="font-semibold text-[#0B6E4F]" href={`/admin/support/${row.id}`}>
                  {row.ticket_number}
                </a>{" "}
                · {row.subject} · {row.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ticket.shop_id ? (
        <div className="lg-card grid gap-2 p-4">
          <a className="text-sm font-semibold text-[#0B6E4F]" href={`/admin/shops/${ticket.shop_id}`}>
            Review shop
          </a>
          {ticket.kind === "shop_report" ? (
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm"
              onClick={() => {
                if (!window.confirm("Set this shop inactive? This is a manual review action, not an automatic ban from one report.")) return;
                void fetch("/api/admin/shops", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "update", shopId: ticket.shop_id, status: "inactive" }),
                }).then(() => router.refresh());
              }}
            >
              Set shop inactive
            </button>
          ) : null}
        </div>
      ) : null}

      {Array.isArray(ticket.attachments)
        ? ticket.attachments.map((file) =>
            file.path ? (
              <a key={file.path} className="text-sm font-semibold text-[#0B6E4F]" href={`/api/support/attachment?path=${encodeURIComponent(file.path)}`}>
                Open evidence
              </a>
            ) : null,
          )
        : null}

      <form
        className="lg-card grid gap-2 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          void post({ action: "internal_note", caseId: ticket.id, body: String(new FormData(form).get("body") || "") });
          form.reset();
        }}
      >
        <label className="text-sm font-medium">
          Internal note (never shown to customers)
          <textarea name="body" required className="mt-1 min-h-20 w-full rounded-xl border px-3 py-2" />
        </label>
        <button className="rounded-xl border px-4 py-2">Add note</button>
      </form>
    </div>
  );
}
