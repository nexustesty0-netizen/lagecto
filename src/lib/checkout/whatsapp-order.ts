import { shopWhatsAppUrl } from "@/lib/brand";
import { money } from "@/lib/format";

export type WhatsAppOrderLine = {
  name: string;
  quantity: number;
  lineTotal: number;
};

export function formatOrderNumber(orderNumber?: string | null) {
  const value = String(orderNumber || "").trim();
  if (!value) return "";
  return value.startsWith("#") ? value : `#${value}`;
}

export function buildShopOrderWhatsAppText(input: {
  shopName: string;
  orderNumber?: string | null;
  products: WhatsAppOrderLine[];
  total: number;
  guestName?: string;
  guestPhone?: string;
}) {
  const productLines = input.products
    .map((product) => `* ${product.name} × ${product.quantity} — ${money(product.lineTotal)}`)
    .join("\n");
  const orderLine = input.orderNumber ? `\nOrder: ${formatOrderNumber(input.orderNumber)}\n` : "\n";
  const guest = [input.guestName?.trim() && `Name: ${input.guestName.trim()}`, input.guestPhone?.trim() && `Phone: ${input.guestPhone.trim()}`]
    .filter(Boolean)
    .join("\n");

  return `Hello ${input.shopName}, I would like to place an order.${orderLine}
Products:

${productLines}

Total: ${money(input.total)}
${guest ? `\n${guest}\n` : ""}
Please confirm my order and let me know how I can pay.`;
}

export function shopCheckoutWhatsAppUrl(phone: string | null | undefined, text: string) {
  return shopWhatsAppUrl(phone, text);
}
