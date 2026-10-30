import { uniqueShopContacts, type ReceiptView, type ReceiptShopDetails } from "@/lib/receipts";

export const QUOTATION_FORMATS = [
  { id: "formal", label: "Formal quote", hint: "Company letterhead, billed to, quote number and date", template: "classic" },
  { id: "proposal", label: "Proposal", hint: "Colored banner with quote number and date", template: "modern" },
  { id: "estimate", label: "Estimate", hint: "Studio layout with a valid-until bar", template: "minimal" },
  { id: "letterhead", label: "Letterhead", hint: "Ledger layout with a boxed total", template: "premium" },
  { id: "quick", label: "Quick quote", hint: "Compact one-page quote", template: "compact" },
] as const;

export type QuotationFormat = (typeof QUOTATION_FORMATS)[number]["id"];
export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export function isQuotationFormat(value: unknown): value is QuotationFormat {
  return QUOTATION_FORMATS.some((format) => format.id === value);
}

export function quotationTemplate(format?: string | null) {
  return QUOTATION_FORMATS.find((row) => row.id === format)?.template || "classic";
}

export type QuotationRecord = {
  id: string;
  quote_number: string;
  created_at: string;
  customer_name: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  format: string;
  status: string;
  valid_until: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string | null;
  shop_details?: ReceiptShopDetails | null;
  items: Array<{
    product_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
};

export function quotationAsReceipt(quote: QuotationRecord): ReceiptView {
  const details = {
    ...(quote.shop_details || {}),
    template: quotationTemplate(quote.format),
  };
  return {
    receipt_number: quote.quote_number,
    created_at: quote.created_at,
    customer_name: quote.customer_name,
    customer_email: quote.customer_email,
    customer_phone: quote.customer_phone,
    payment_method: null,
    payment_status: quote.status,
    subtotal: Number(quote.subtotal || 0),
    discount: Number(quote.discount || 0),
    tax: Number(quote.tax || 0),
    total: Number(quote.total || 0),
    notes: quote.notes,
    documentKind: "quotation",
    valid_until: quote.valid_until,
    shop_details: details,
    items: quote.items,
  };
}

export function whatsappQuotationText(quote: QuotationRecord) {
  const view = quotationAsReceipt(quote);
  const shop = view.shop_details?.name || "LaGecto shop";
  const lines = view.items
    .map((item) => `• ${item.product_name} x${item.quantity} — $${Number(item.total_price).toFixed(2)}`)
    .join("\n");
  const contact = uniqueShopContacts(view.shop_details);
  const extra = [
    view.valid_until ? `Valid until: ${view.valid_until}` : "",
    contact.phone ? `Phone: ${contact.phone}` : "",
    contact.email ? `Email: ${contact.email}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `Quotation ${view.receipt_number} from ${shop}\n${lines}\nTotal: $${Number(view.total).toFixed(2)}\n${extra ? `${extra}\n` : ""}This is a quotation, not a receipt.`;
}
