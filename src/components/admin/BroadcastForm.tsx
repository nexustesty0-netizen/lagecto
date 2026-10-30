"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BroadcastForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSent("");
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        message: form.get("message"),
        audience: form.get("audience"),
        targetId: form.get("targetId") || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Unable to send this update.");
    else {
      setSent(`Sent to ${data.sent || 0} recipient inboxes.`);
      event.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4">
      <input name="title" required placeholder="Title" className="rounded-xl border px-3 py-2" />
      <textarea name="message" required placeholder="Message" className="min-h-24 rounded-xl border px-3 py-2" />
      <select name="audience" className="rounded-xl border px-3 py-2">
        <option value="customers">All customers</option>
        <option value="shops">All shops</option>
        <option value="specific_customer">Specific customer</option>
        <option value="specific_shop">Specific shop</option>
      </select>
      <input name="targetId" placeholder="Customer or shop UUID (only for specific)" className="rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Send update</button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {sent ? <p className="text-sm text-[#0B6E4F]">{sent}</p> : null}
    </form>
  );
}
