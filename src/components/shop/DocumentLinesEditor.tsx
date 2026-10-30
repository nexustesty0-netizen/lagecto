"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import type { TicketLine, TicketProduct } from "@/lib/shop/ticket";

export function DocumentLinesEditor({
  products,
  lines,
  onChange,
}: {
  products: TicketProduct[];
  lines: TicketLine[];
  onChange: (lines: TicketLine[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [message, setMessage] = useState("");

  const visible = products.filter((product) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return product.name.toLowerCase().includes(q) || String(product.barcode || "").toLowerCase() === q;
  });

  function addProduct(product: TicketProduct) {
    onChange(
      lines.some((row) => row.productId === product.id)
        ? lines.map((row) => (row.productId === product.id ? { ...row, quantity: row.quantity + 1 } : row))
        : [
            ...lines,
            {
              id: product.id,
              productId: product.id,
              name: product.name,
              quantity: 1,
              unitPrice: Number(product.price),
            },
          ],
    );
  }

  function addCustom() {
    const name = customName.trim();
    const unitPrice = Number(customPrice);
    if (!name) {
      setMessage("Type a name for this line.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setMessage("Enter a valid price.");
      return;
    }
    onChange([
      ...lines,
      { id: crypto.randomUUID(), productId: null, name, quantity: 1, unitPrice },
    ]);
    setCustomName("");
    setCustomPrice("");
    setMessage("");
  }

  const total = lines.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div>
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
          <input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Typed item or service" className="rounded-xl border px-3 py-2" />
          <input value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} type="number" min={0} step="0.01" placeholder="Price" className="rounded-xl border px-3 py-2" />
          <button type="button" className="rounded-xl bg-[#0B6E4F] px-4 py-2 text-sm text-white" onClick={addCustom}>
            Add line
          </button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalogue" className="mt-3 w-full rounded-xl border px-3 py-2" />
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">
          {visible.slice(0, 40).map((product) => (
            <button key={product.id} type="button" onClick={() => addProduct(product)} className="rounded-xl border bg-white px-3 py-2 text-left text-sm">
              {product.name} · {money(product.price)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <ul className="grid gap-2 text-sm">
          {lines.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) =>
                  onChange(
                    lines
                      .map((row) => (row.id === item.id ? { ...row, quantity: Number(event.target.value || 1) } : row))
                      .filter((row) => row.quantity > 0),
                  )
                }
                className="w-16 rounded-lg border px-2 py-1"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={item.unitPrice}
                onChange={(event) =>
                  onChange(lines.map((row) => (row.id === item.id ? { ...row, unitPrice: Number(event.target.value || 0) } : row)))
                }
                className="w-24 rounded-lg border px-2 py-1"
              />
              <span className="w-20 text-right">{money(item.unitPrice * item.quantity)}</span>
              <button type="button" className="text-xs text-red-700" onClick={() => onChange(lines.filter((row) => row.id !== item.id))}>
                Remove
              </button>
            </li>
          ))}
          {!lines.length ? <li className="text-[#6B7280]">Add a catalogue item or type a custom line.</li> : null}
        </ul>
        <p className="mt-3 text-right text-lg font-semibold">{money(total)}</p>
        {message ? <p className="mt-2 text-sm text-red-700">{message}</p> : null}
      </div>
    </div>
  );
}
