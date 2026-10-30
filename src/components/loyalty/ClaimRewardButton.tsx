"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimRewardButton({ rewardId }: { rewardId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function claim() {
    setBusy(true);
    const res = await fetch("/api/loyalty/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to claim this reward.");
      return;
    }
    setMessage(data.promo_code ? `Claimed. Your code is ${data.promo_code}.` : "Claimed.");
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button type="button" disabled={busy} onClick={() => void claim()} className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
        {busy ? "Checking…" : "Claim"}
      </button>
      {message ? <p className="mt-2 text-sm text-[var(--lagecto-muted)]">{message}</p> : null}
    </div>
  );
}
