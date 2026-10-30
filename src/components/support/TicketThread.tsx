"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/format";

export function TicketThread({
  ticket,
  messages,
  notes,
  isAdmin,
}: {
  ticket: {
    id: string;
    ticket_number: string;
    subject: string;
    description: string;
    status: string;
    kind: string;
    priority: string;
    category: string;
    created_at: string;
    updated_at: string;
    attachments?: { path?: string; mime?: string }[] | null;
  };
  messages: { id: string; body: string; is_staff: boolean; created_at: string }[];
  notes?: { id: string; body: string; created_at: string }[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function reply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") || "");
    const res = await fetch("/api/support/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: ticket.id, body }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to send.");
    else {
      form.reset();
      router.refresh();
    }
  }

  return (
    <div className="grid gap-6">
      <header className="lg-card p-5">
        <p className="font-mono text-sm text-[#0B6E4F]">{ticket.ticket_number}</p>
        <h1 className="mt-1 text-2xl font-semibold">{ticket.subject}</h1>
        <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
          {ticket.kind} · {ticket.category} · created {formatDateTime(ticket.created_at)} · updated {formatDateTime(ticket.updated_at)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge value={ticket.status} />
          <StatusBadge value={ticket.priority} />
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>
        {Array.isArray(ticket.attachments) && ticket.attachments.length ? (
          <div className="mt-4 grid gap-2">
            {ticket.attachments.map((file) =>
              file.path ? (
                <a key={file.path} className="text-sm font-semibold text-[#0B6E4F]" href={`/api/support/attachment?path=${encodeURIComponent(file.path)}`}>
                  View attached image
                </a>
              ) : null,
            )}
          </div>
        ) : null}
      </header>
      <section className="grid gap-3">
        <h2 className="font-semibold">Conversation</h2>
        {!messages.length ? <p className="text-sm text-[var(--lagecto-muted)]">No replies yet.</p> : null}
        {messages.map((row) => (
          <article key={row.id} className={`rounded-2xl p-4 ${row.is_staff ? "bg-[#0B6E4F]/8" : "bg-white"}`}>
            <p className="text-xs text-[var(--lagecto-muted)]">{row.is_staff ? "LaGecto Support" : isAdmin ? "Customer" : "You"} · {formatDateTime(row.created_at)}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{row.body}</p>
          </article>
        ))}
      </section>
      {isAdmin && notes?.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold">Internal notes (not visible to the customer)</h2>
          {notes.map((note) => (
            <p key={note.id} className="mt-2 text-sm">
              {note.body} <span className="text-xs text-[var(--lagecto-muted)]">· {formatDateTime(note.created_at)}</span>
            </p>
          ))}
        </section>
      ) : null}
      <form onSubmit={(event) => void reply(event)} className="grid gap-2">
        <textarea name="body" required placeholder="Write a reply" className="min-h-24 rounded-xl border px-3 py-2" />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Send</button>
      </form>
    </div>
  );
}
