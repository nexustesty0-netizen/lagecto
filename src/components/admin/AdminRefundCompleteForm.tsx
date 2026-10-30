"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminRefundCompleteForm({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/payments/refund-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refundId,
        providerRefundId: String(form.get("providerRefundId") || ""),
      }),
    });
    const data = await res.json();
    setMessage(data.error || "Provider refund recorded.");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input name="providerRefundId" required placeholder="Paynow refund ref" className="rounded-lg border px-2 py-1 text-sm" />
      <button className="rounded-lg border px-2 py-1 text-sm">Record</button>
      {message ? <span className="text-xs text-[#6B7280]">{message}</span> : null}
    </form>
  );
}
