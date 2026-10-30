"use client";

import { useState } from "react";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments/methods";

export function PaymentMethodsForm({
  methods,
  endpoint = "/api/shop/payments/methods",
}: {
  methods: PaymentMethod[];
  endpoint?: string;
}) {
  const [selected, setSelected] = useState<PaymentMethod[]>(methods.length ? methods : ["cash"]);
  const [message, setMessage] = useState("");

  function toggle(method: PaymentMethod) {
    setSelected((current) =>
      current.includes(method) ? current.filter((item) => item !== method) : [...current, method],
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methods: selected }),
    });
    const data = await res.json();
    setMessage(data.error || "Payment methods saved.");
  }

  return (
    <form onSubmit={onSubmit} className="lg-card grid gap-3 p-5">
      <h2 className="font-semibold">Payment methods</h2>
      <p className="text-sm text-[#6B7280]">
        Customers only see methods you enable. Card details are never typed into LaGecto.
      </p>
      {PAYMENT_METHODS.map((method) => (
        <label key={method} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(method)} onChange={() => toggle(method)} />
          {PAYMENT_METHOD_LABELS[method]}
        </label>
      ))}
      <button className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-white">Save payment methods</button>
      {message ? <p className="text-sm text-[#0B6E4F]">{message}</p> : null}
    </form>
  );
}
