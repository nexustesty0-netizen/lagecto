"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentLinesEditor } from "@/components/shop/DocumentLinesEditor";
import { POS_PAYMENT_METHODS, ticketPayload, type TicketLine, type TicketProduct } from "@/lib/shop/ticket";

export type EditableSale = {
  id: string;
  kind: "sale" | "receipt";
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  cashier_name?: string | null;
  time_taken?: string | null;
  notes?: string | null;
  items: Array<{ product_id?: string | null; product_name: string; quantity: number; unit_price: number }>;
};

export function SaleEditor({
  record,
  products,
}: {
  record: EditableSale;
  products: TicketProduct[];
}) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState(record.customer_name || "");
  const [customerEmail, setCustomerEmail] = useState(record.customer_email || "");
  const [customerPhone, setCustomerPhone] = useState(record.customer_phone || "");
  const [paymentMethod, setPaymentMethod] = useState(record.payment_method || "cash");
  const [cashierName, setCashierName] = useState(record.cashier_name || "");
  const [timeTaken, setTimeTaken] = useState(record.time_taken || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [lines, setLines] = useState<TicketLine[]>(
    record.items.map((item, index) => ({
      id: item.product_id || `line-${index}`,
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!lines.length) {
      setMessage("Add at least one item.");
      return;
    }
    setBusy(true);
    setMessage("");
    const endpoint = record.kind === "receipt" ? "/api/shop/receipts" : "/api/shop/sales";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: record.id,
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod,
        cashierName,
        timeTaken,
        notes,
        items: ticketPayload(lines),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to save these changes.");
      return;
    }
    router.push(record.kind === "receipt" ? `/shop/receipts/${record.id}` : `/shop/sales`);
    router.refresh();
  }

  return (
    <form
      className="lg-card grid gap-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-sm text-[#6B7280]">
        Use this only to correct a mistake. Stock is returned and then taken again from the new lines.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="rounded-xl border px-3 py-2" />
        <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Customer phone" className="rounded-xl border px-3 py-2" />
        <input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Customer email" className="rounded-xl border px-3 py-2" />
        <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="rounded-xl border px-3 py-2">
          {POS_PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
        <input value={cashierName} onChange={(event) => setCashierName(event.target.value)} placeholder="Cashier name" className="rounded-xl border px-3 py-2" />
        <input value={timeTaken} onChange={(event) => setTimeTaken(event.target.value)} placeholder="Time taken" className="rounded-xl border px-3 py-2" />
      </div>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" className="min-h-20 rounded-xl border px-3 py-2" />
      <DocumentLinesEditor products={products} lines={lines} onChange={setLines} />
      <button disabled={busy} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Saving…" : "Save correction"}
      </button>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
    </form>
  );
}
