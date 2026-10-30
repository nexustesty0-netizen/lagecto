"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConfirmCashButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function confirmCash() {
    if (!window.confirm("Confirm that cash was received for this order?")) return;
    setBusy(true);
    await fetch("/api/shop/payments/confirm-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <button disabled={busy} onClick={confirmCash} className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white">
      Confirm cash
    </button>
  );
}
