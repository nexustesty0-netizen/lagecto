"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartPeriodButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    if (!confirm("Archive the current period and start a new one at zero? Existing records stay available in Archives.")) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/shop/financials/period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }
  return (
    <button disabled={busy} onClick={start} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white">
      Start new financial period
    </button>
  );
}
