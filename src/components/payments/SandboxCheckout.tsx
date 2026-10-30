"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/format";

export function SandboxCheckout({
  paymentId,
  amount,
  method,
}: {
  paymentId: string;
  amount: number;
  method: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish(outcome: "success" | "fail") {
    setBusy(true);
    const res = await fetch(`/api/payments/${paymentId}/sandbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Test payment failed.");
      return;
    }
    router.push(`/customer/payments/${paymentId}/return`);
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">Test mode</p>
      <h1 className="mt-2 text-2xl font-semibold">Sandbox checkout</h1>
      <p className="mt-2 text-sm text-[#6B7280]">
        No real money is charged. Do not enter real card numbers. This screen only exists when LaGecto is using the sandbox provider.
      </p>
      <p className="mt-4 font-semibold">{money(amount)} · {method}</p>
      <div className="mt-6 flex gap-2">
        <button disabled={busy} onClick={() => finish("success")} className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">
          Simulate successful payment
        </button>
        <button disabled={busy} onClick={() => finish("fail")} className="rounded-xl border px-4 py-2">
          Simulate failed payment
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
