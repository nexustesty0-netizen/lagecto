"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentLinesEditor } from "@/components/shop/DocumentLinesEditor";
import { ReceiptDocument } from "@/components/receipts/ReceiptDocument";
import { quotationAsReceipt, QUOTATION_FORMATS, QUOTATION_STATUSES, type QuotationFormat, type QuotationRecord } from "@/lib/quotations";
import { ticketPayload, type TicketLine, type TicketProduct } from "@/lib/shop/ticket";

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export function QuoteEditor({
  shopName,
  products,
  initial,
  shopDetails,
}: {
  shopName: string;
  products: TicketProduct[];
  initial?: QuotationRecord | null;
  shopDetails?: QuotationRecord["shop_details"];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<QuotationFormat>(
    QUOTATION_FORMATS.some((row) => row.id === initial?.format) ? (initial!.format as QuotationFormat) : "formal",
  );
  const [status, setStatus] = useState(initial?.status || "draft");
  const [customerName, setCustomerName] = useState(initial?.customer_name || "");
  const [customerEmail, setCustomerEmail] = useState(initial?.customer_email || "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone || "");
  const [validUntil, setValidUntil] = useState(initial?.valid_until || defaultValidUntil());
  const [notes, setNotes] = useState(initial?.notes || "");
  const [lines, setLines] = useState<TicketLine[]>(
    (initial?.items || []).map((item, index) => ({
      id: item.product_id || `line-${index}`,
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const preview = useMemo(
    () =>
      quotationAsReceipt({
        id: initial?.id || "preview",
        quote_number: initial?.quote_number || "Q-PREVIEW",
        created_at: initial?.created_at || new Date().toISOString(),
        customer_name: customerName || "Customer",
        customer_email: customerEmail,
        customer_phone: customerPhone,
        format,
        status,
        valid_until: validUntil,
        subtotal: lines.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0),
        discount: 0,
        tax: 0,
        total: lines.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0),
        notes,
        shop_details: {
          ...(shopDetails || {}),
          ...(initial?.shop_details || {}),
          name: shopName,
          template: QUOTATION_FORMATS.find((row) => row.id === format)?.template,
        },
        items: lines.map((row) => ({
          product_id: row.productId,
          product_name: row.name,
          quantity: row.quantity,
          unit_price: row.unitPrice,
          total_price: row.unitPrice * row.quantity,
        })),
      }),
    [customerEmail, customerName, customerPhone, format, initial, lines, notes, shopDetails, shopName, status, validUntil],
  );

  async function save() {
    if (!lines.length) {
      setMessage("Add at least one item.");
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/shop/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        id: initial?.id,
        format,
        status,
        customerName,
        customerEmail,
        customerPhone,
        validUntil,
        notes,
        items: ticketPayload(lines),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Unable to save this quotation.");
      return;
    }
    router.push(`/shop/quotations/${data.id}`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <form
        className="lg-card grid gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Format</p>
          <div className="mt-2 grid gap-2">
            {QUOTATION_FORMATS.map((row) => (
              <label key={row.id} className="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm">
                <input type="radio" name="format" checked={format === row.id} onChange={() => setFormat(row.id)} className="mt-1" />
                <span>
                  <span className="font-medium">{row.label}</span>
                  <span className="mt-0.5 block text-xs text-[#6B7280]">{row.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" className="rounded-xl border px-3 py-2" />
          <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Customer phone" className="rounded-xl border px-3 py-2" />
          <input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Customer email" className="rounded-xl border px-3 py-2" />
          <label className="text-sm">
            Valid until
            <input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="text-sm">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
              {QUOTATION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes or terms" className="min-h-24 rounded-xl border px-3 py-2" />
        <DocumentLinesEditor products={products} lines={lines} onChange={setLines} />
        <button disabled={busy} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Saving…" : initial?.id ? "Save quotation" : "Create quotation"}
        </button>
        {message ? <p className="text-sm text-red-700">{message}</p> : null}
      </form>
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">Preview</p>
        <ReceiptDocument receipt={preview} />
      </div>
    </div>
  );
}
