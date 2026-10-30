export const POS_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "ecocash", label: "EcoCash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const;

export type TicketLine = {
  id: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type TicketProduct = {
  id: string;
  name: string;
  price: number;
  stock?: number | null;
  type?: string | null;
  barcode?: string | null;
};

export function ticketPayload(lines: TicketLine[]) {
  return lines.map((item) => ({
    product_id: item.productId || null,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }));
}
