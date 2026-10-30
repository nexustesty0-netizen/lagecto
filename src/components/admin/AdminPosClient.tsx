"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { DURATION_KEYS, DURATION_LABELS, PACKAGE_PRICES, PAID_PACKAGE_KEYS } from "@/lib/packages";

type Line = { id: string; name: string; quantity: number; unit_price: number };

const DURATIONS = DURATION_KEYS;

export function AdminPosClient() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.unit_price) * line.quantity, 0),
    [lines],
  );

  function addLine(nextName: string, nextPrice: number, nextQty = 1) {
    const trimmed = nextName.trim();
    if (!trimmed || nextPrice < 0) return;
    setLines((current) => [
      ...current,
      { id: crypto.randomUUID(), name: trimmed, quantity: Math.max(1, nextQty), unit_price: nextPrice },
    ]);
    setName("");
    setPrice("");
    setQuantity("1");
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/admin/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((line) => ({ name: line.name, quantity: line.quantity, unit_price: line.unit_price })),
        paymentMethod: form.get("payment"),
        customerName: form.get("customer"),
        customerPhone: form.get("phone"),
        notes: form.get("notes"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Unable to record this payment.");
      return;
    }
    setLines([]);
    setReceiptId(data.receipt_id);
    setMessage(`Payment recorded. Receipt ${data.receipt_number}.`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="grid gap-4">
        <article className="lg-card grid gap-3 p-5">
          <h2 className="font-semibold">Add item</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Item or service" className="rounded-xl border px-3 py-2" />
            <input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min={0} step="0.01" placeholder="Price" className="rounded-xl border px-3 py-2" />
            <input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min={1} placeholder="Qty" className="rounded-xl border px-3 py-2" />
            <button
              type="button"
              className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white"
              onClick={() => addLine(name, Number(price || 0), Number(quantity || 1))}
            >
              Add
            </button>
          </div>
        </article>
        <article className="lg-card p-5">
          <h2 className="font-semibold">Quick packages</h2>
          <p className="mt-1 text-sm text-[#6B7280]">Add a LaGecto shop package as a line item.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {PAID_PACKAGE_KEYS.map((key) => (
              <div key={key} className="rounded-xl border p-3">
                <p className="font-semibold capitalize">{key}</p>
                <div className="mt-2 grid gap-1">
                  {DURATIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      className="rounded-lg px-2 py-1 text-left text-sm hover:bg-[#F7F3E3]"
                      onClick={() => addLine(`${key} · ${DURATION_LABELS[duration]}`, PACKAGE_PRICES[key][duration])}
                    >
                      {DURATION_LABELS[duration]} · {money(PACKAGE_PRICES[key][duration])}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
      <form onSubmit={checkout} className="lg-card p-5">
        <h2 className="font-semibold">Current sale</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-3">
              <span>
                {line.name} × {line.quantity}
              </span>
              <span className="flex items-center gap-3">
                {money(line.unit_price * line.quantity)}
                <button type="button" className="text-[#C2413B]" onClick={() => setLines((current) => current.filter((row) => row.id !== line.id))}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xl font-semibold">Total {money(subtotal)}</p>
        <input name="customer" placeholder="Customer name" className="mt-3 w-full rounded-xl border px-3 py-2" />
        <input name="phone" placeholder="Phone (optional)" className="mt-2 w-full rounded-xl border px-3 py-2" />
        <input name="notes" placeholder="Notes (optional)" className="mt-2 w-full rounded-xl border px-3 py-2" />
        <select name="payment" className="mt-2 w-full rounded-xl border px-3 py-2">
          <option value="cash">Cash</option>
          <option value="ecocash">EcoCash</option>
          <option value="visa">Visa</option>
          <option value="mastercard">Mastercard</option>
          <option value="bank">Bank transfer</option>
        </select>
        <button disabled={!lines.length} className="mt-3 w-full rounded-xl bg-[#0B6E4F] py-3 text-white disabled:opacity-50">
          Record payment & generate receipt
        </button>
        {message ? <p className="mt-2 text-sm text-[#0B6E4F]">{message}</p> : null}
        {receiptId ? (
          <a className="mt-2 inline-block text-sm font-semibold text-[#0B6E4F]" href={`/admin/receipts/${receiptId}`}>
            View receipt
          </a>
        ) : null}
      </form>
    </div>
  );
}
