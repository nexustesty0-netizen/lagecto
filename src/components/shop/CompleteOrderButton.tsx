"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompleteOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function complete() {
    if (!confirm("Complete this order and generate a receipt?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shop/orders/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        setError(data.error || "Unable to complete this order.");
        return;
      }
      if (data.receipt_id) {
        router.push(`/shop/receipts/${data.receipt_id}`);
        router.refresh();
        return;
      }
      setError("Order completed but no receipt was returned. Open Receipts and try Complete again.");
      router.refresh();
    } catch {
      setError("Unable to complete this order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid justify-end gap-1">
      <button disabled={busy} onClick={() => void complete()} className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white disabled:opacity-60">
        {busy ? "Completing…" : "Complete"}
      </button>
      {error ? <p className="max-w-48 text-right text-xs text-[#C2413B]">{error}</p> : null}
    </div>
  );
}
