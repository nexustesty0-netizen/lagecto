"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SELF_SERVE_SHOP_CREATION } from "@/lib/platform-flags";

export function SelfServeShopToggle({
  enabled,
  used = 0,
  limit = 12,
}: {
  enabled: boolean;
  used?: number;
  limit?: number;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const full = used >= limit;

  async function toggle() {
    const next = !on;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/platform-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: SELF_SERVE_SHOP_CREATION, enabled: next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to update public shop creation.");
      return;
    }
    setOn(next);
    setMessage(
      next
        ? "People can create shops from Register a shop and get a Shop ID immediately."
        : "Public shop creation is off. New shops wait for LaGecto to activate them.",
    );
    router.refresh();
  }

  return (
    <article className="lg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Public shop creation</p>
      <h2 className="mt-1 text-lg font-semibold">
        {full ? "Self-serve shops are full" : on ? "People can open shops themselves" : "LaGecto activates new shops"}
      </h2>
      <p className="mt-2 text-sm text-[var(--lagecto-muted)]">
        {used} of {limit} self-serve shops have been used. After 12, the register-shop portal closes and new shops must request activation.
      </p>
      <button
        type="button"
        disabled={busy || (full && !on)}
        onClick={() => void toggle()}
        className={`mt-4 min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold ${
          on ? "border border-[#C2413B] text-[#C2413B]" : "bg-[#0B6E4F] text-white"
        }`}
      >
        {busy ? "Saving…" : on ? "Disable public shop creation" : full ? "Limit reached" : "Enable public shop creation"}
      </button>
      {message ? <p className="mt-3 text-sm text-[#0B6E4F]">{message}</p> : null}
    </article>
  );
}
