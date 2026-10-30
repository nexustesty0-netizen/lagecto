"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefundRequestForm({
  paymentId,
  amount,
  kind,
}: {
  paymentId: string;
  amount: number;
  kind: "provider" | "cash";
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/shop/payments/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId,
        amount: Number(form.get("amount") || amount),
        reason: String(form.get("reason") || ""),
        kind,
      }),
    });
    const data = await res.json();
    setMessage(data.error || (kind === "cash" ? "Cash refund requested. Confirm after the cash is returned." : "Refund requested. Provider refunds stay requested until Paynow confirms them."));
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2">
      <input name="amount" type="number" step="0.01" min="0.01" max={amount} defaultValue={amount} className="rounded-xl border px-3 py-2 text-sm" />
      <input name="reason" placeholder="Reason" className="rounded-xl border px-3 py-2 text-sm" />
      <button className="rounded-lg border px-3 py-2 text-sm">{kind === "cash" ? "Request cash refund" : "Request refund"}</button>
      {message ? <p className="text-xs text-[#6B7280]">{message}</p> : null}
    </form>
  );
}

export function CompleteCashRefundButton({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function complete() {
    setBusy(true);
    await fetch("/api/shop/payments/refund-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refundId }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <button disabled={busy} onClick={complete} className="rounded-lg bg-[#0B6E4F] px-3 py-1 text-sm text-white">
      Confirm cash returned
    </button>
  );
}
