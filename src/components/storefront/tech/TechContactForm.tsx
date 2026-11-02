"use client";

import { useState } from "react";

export function TechContactForm({ shopId, shopName }: { shopId: string; shopName: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const subject = String(data.get("subject") || "").trim();
    const body = String(data.get("message") || "").trim();
    if (name.length < 2) {
      setStatus("error");
      setMessage("Enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      setStatus("error");
      setMessage("Enter a phone number we can reach.");
      return;
    }
    if (subject.length < 3 || body.length < 10) {
      setStatus("error");
      setMessage("Add a subject and a short message.");
      return;
    }
    setStatus("sending");
    setMessage("");
    const res = await fetch(`/api/shops/${shopId}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, subject, message: body, shopName }),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setStatus("error");
      setMessage(json?.error || "Unable to send this message. Try WhatsApp or call the shop.");
      return;
    }
    setStatus("ok");
    setMessage("Message sent. The shop will see it in their requests inbox.");
    form.reset();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-1 text-sm font-medium">
        Full name
        <input required name="name" autoComplete="name" className="min-h-12 border border-black/10 px-3 font-normal" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Email address
          <input required name="email" type="email" autoComplete="email" className="min-h-12 border border-black/10 px-3 font-normal" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Phone number
          <input required name="phone" type="tel" autoComplete="tel" className="min-h-12 border border-black/10 px-3 font-normal" />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Subject
        <input required name="subject" className="min-h-12 border border-black/10 px-3 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Message
        <textarea required name="message" minLength={10} className="min-h-32 border border-black/10 px-3 py-3 font-normal" />
      </label>
      <button disabled={status === "sending"} className="min-h-12 bg-[var(--sf-primary)] px-6 text-sm font-semibold text-white disabled:opacity-60">
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
      {message ? (
        <p className={`text-sm ${status === "ok" ? "text-[var(--sf-primary)]" : "text-[#C2413B]"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
