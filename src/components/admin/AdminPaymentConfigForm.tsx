"use client";

import { useState } from "react";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payments/methods";

export function AdminPaymentConfigForm({
  enabledMethods,
  provider,
  mode,
  paynowConfigured,
}: {
  enabledMethods: PaymentMethod[];
  provider: string;
  mode: string;
  paynowConfigured: boolean;
}) {
  const [selected, setSelected] = useState<PaymentMethod[]>(enabledMethods);
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/admin/payments/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methods: selected }),
    });
    const data = await res.json();
    setMessage(data.error || "Platform payment methods saved.");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-5">
      <h2 className="font-semibold">Checkout</h2>
      <p className="text-sm text-[#6B7280]">
        Marketplace checkout is via WhatsApp. Customers do not pay inside LaGecto. This form is kept so online collection
        can be switched on later without rebuilding orders.
      </p>
      <dl className="grid gap-1 text-sm">
        <div className="flex justify-between"><dt>Provider</dt><dd>{provider}</dd></div>
        <div className="flex justify-between"><dt>Mode</dt><dd>{mode}</dd></div>
        <div className="flex justify-between"><dt>Paynow keys configured</dt><dd>{paynowConfigured ? "Yes" : "No"}</dd></div>
      </dl>
      {PAYMENT_METHODS.map((method) => (
        <label key={method} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(method)}
            onChange={() =>
              setSelected((current) =>
                current.includes(method) ? current.filter((item) => item !== method) : [...current, method],
              )
            }
          />
          Allow {PAYMENT_METHOD_LABELS[method]}
        </label>
      ))}
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save platform methods</button>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </form>
  );
}
