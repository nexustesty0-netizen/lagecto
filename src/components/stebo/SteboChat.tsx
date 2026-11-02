"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SteboChat({
  mode,
  title,
  initialConversationId,
  messages,
}: {
  mode: string;
  title: string;
  initialConversationId?: string | null;
  messages?: { role: string; content: string }[];
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId || "");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState(messages || []);

  useEffect(() => {
    setLocal(messages || []);
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    setPending(true);
    setError("");
    const response = await fetch("/api/stebo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input, mode, conversationId }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Stebo could not reply.");
      return;
    }
    setConversationId(data.conversationId);
    setLocal((current) => [...current, { role: "user", content: input }, { role: "assistant", content: data.reply }]);
    setInput("");
    router.refresh();
  }

  return (
    <section className="grid gap-4 rounded-2xl bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid max-h-[420px] gap-3 overflow-y-auto">
        {local.map((message, index) => (
          <article key={index} className={`rounded-xl p-3 text-sm ${message.role === "user" ? "bg-[#F7F3E3]" : "bg-[#0B6E4F]/10"}`}>
            <p className="text-xs uppercase text-[#6B7280]">{message.role}</p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}
      </div>
      <form onSubmit={send} className="grid gap-2">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} className="min-h-20 rounded-xl border px-3 py-2" placeholder="Message Stebo" />
        <button disabled={pending} className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-60">
          {pending ? "Thinking…" : "Send"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </section>
  );
}
