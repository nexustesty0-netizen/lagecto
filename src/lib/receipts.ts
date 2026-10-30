import { contrastRatio, ensureContrast, bestTextOn, normalizeHex } from "@/lib/storefront/theme";

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const RECEIPT_TEMPLATES = ["classic", "modern", "minimal", "premium", "compact"] as const;
export type ReceiptTemplate = (typeof RECEIPT_TEMPLATES)[number];

export const RECEIPT_SIZES = ["a4", "thermal80", "thermal58"] as const;
export type ReceiptSize = (typeof RECEIPT_SIZES)[number];

export const RECEIPT_HEADER_LAYOUTS = ["centered", "left", "banner"] as const;
export type ReceiptHeaderLayout = (typeof RECEIPT_HEADER_LAYOUTS)[number];

export type ReceiptKind = "shop" | "platform";

export type ReceiptShopDetails = {
  kind?: ReceiptKind | string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  logo_url?: string | null;
  shop_id?: string;
  slug?: string;
  template?: string;
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  header?: string | null;
  footer?: string | null;
  header_layout?: string;
  size?: string;
  show_logo?: boolean;
  show_contact?: boolean;
};

export type ShopDocumentKind = "receipt" | "quotation";

export type ReceiptView = {
  receipt_number: string;
  created_at: string;
  customer_name: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  payment_method: string | null;
  payment_status?: string | null;
  provider_transaction_id?: string | null;
  order_id?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cashier_name?: string | null;
  time_taken?: string | null;
  notes?: string | null;
  documentKind?: ShopDocumentKind;
  valid_until?: string | null;
  shop_details?: ReceiptShopDetails | null;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
};

export function shopDocumentCopy(receipt: Pick<ReceiptView, "documentKind" | "valid_until" | "payment_method">) {
  const quote = receipt.documentKind === "quotation";
  return {
    title: quote ? "QUOTATION" : "RECEIPT",
    numberLabel: quote ? "Quote #" : "Receipt #",
    numberLong: quote ? "Quote number" : "Receipt number",
    dateLabel: quote ? "Quote date" : "Receipt date",
    orderLabel: quote ? "Quote no." : "Order no.",
    payLabel: quote ? "Valid until" : "Payment",
    payMethodLabel: quote ? "Valid until" : "Payment method",
    thanks: quote ? "THIS IS A QUOTE" : "THANK YOU",
    footerThanks: quote ? "This is a quotation, not a tax invoice or receipt." : "Thank you for your purchase.",
    powered: quote ? "Quotation from LaGecto Marketplace" : "Powered by LaGecto Marketplace",
  };
}

export type ReceiptTheme = {
  kind: ReceiptKind;
  template: ReceiptTemplate;
  size: ReceiptSize;
  headerLayout: ReceiptHeaderLayout;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
  onPrimary: string;
  paper: string;
  contrastWarning: string | null;
};

export type ReceiptDesign = {
  template: ReceiptTemplate;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  headerLayout: ReceiptHeaderLayout;
  size: ReceiptSize;
  header: string;
  footerMessage: string;
  showLogo: boolean;
  showContact: boolean;
};

export function isReceiptTemplate(value: unknown): value is ReceiptTemplate {
  return RECEIPT_TEMPLATES.includes(String(value || "") as ReceiptTemplate);
}

export function resolveReceiptTheme(details?: ReceiptShopDetails | null): ReceiptTheme {
  const kind: ReceiptKind = details?.kind === "platform" ? "platform" : "shop";
  const template = isReceiptTemplate(details?.template) ? details.template : kind === "platform" ? "premium" : "classic";
  const size = RECEIPT_SIZES.includes(String(details?.size || "") as ReceiptSize) ? (details?.size as ReceiptSize) : "a4";
  const headerLayout = RECEIPT_HEADER_LAYOUTS.includes(String(details?.header_layout || "") as ReceiptHeaderLayout)
    ? (details?.header_layout as ReceiptHeaderLayout)
    : "centered";
  const fallbackPrimary = kind === "platform" ? "#0B6E4F" : "#0B6E4F";
  const primary = normalizeHex(details?.primary, fallbackPrimary);
  const secondary = normalizeHex(details?.secondary, "#2E8B57");
  const accent = normalizeHex(details?.accent, "#D4AF37");
  const background = normalizeHex(details?.background, "#FFFDF8");
  const paper = background;
  const text = ensureContrast("#12241C", paper, 4.5);
  const muted = ensureContrast("#5A6A62", paper, 3);
  const onPrimary = bestTextOn(primary);
  const bgText = contrastRatio(text, paper);
  const contrastWarning =
    bgText < 4.5
      ? "Text may be hard to read on this background. Colors were adjusted automatically where possible."
      : contrastRatio(onPrimary, primary) < 3
        ? "Header text contrast is low. A lighter or darker header treatment will be used when printing."
        : null;
  return { kind, template, size, headerLayout, primary, secondary, accent, background, text, muted, onPrimary, paper, contrastWarning };
}

export function designFromShop(input: {
  receipt_template?: string | null;
  receipt_header?: string | null;
  receipt_footer?: string | null;
  receipt_customization?: Record<string, unknown> | null;
  storefront?: { primary_color?: string | null; secondary_color?: string | null; accent_color?: string | null; background_color?: string | null } | null;
}): ReceiptDesign {
  const custom = input.receipt_customization || {};
  const template = isReceiptTemplate(custom.template) ? custom.template : isReceiptTemplate(input.receipt_template) ? input.receipt_template : "classic";
  return {
    template,
    primary: normalizeHex(String(custom.primary || input.storefront?.primary_color || ""), "#0B6E4F"),
    secondary: normalizeHex(String(custom.secondary || input.storefront?.secondary_color || ""), "#2E8B57"),
    accent: normalizeHex(String(custom.accent || input.storefront?.accent_color || ""), "#D4AF37"),
    background: normalizeHex(String(custom.background || input.storefront?.background_color || ""), "#FFFDF8"),
    headerLayout: RECEIPT_HEADER_LAYOUTS.includes(String(custom.headerLayout || "") as ReceiptHeaderLayout)
      ? (custom.headerLayout as ReceiptHeaderLayout)
      : "centered",
    size: RECEIPT_SIZES.includes(String(custom.size || "") as ReceiptSize) ? (custom.size as ReceiptSize) : "a4",
    header: String(custom.header || input.receipt_header || ""),
    footerMessage: String(custom.footerMessage || custom.footer || input.receipt_footer || ""),
    showLogo: custom.showLogo !== false,
    showContact: custom.showContact !== false,
  };
}

export type UniqueShopContact = {
  name: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
};

export function uniqueShopContacts(shop?: ReceiptShopDetails | null): UniqueShopContact {
  const name = String(shop?.name || "").trim();
  const address = String(shop?.address || "").trim();
  const email = String(shop?.email || "").trim();
  const listedPhone = String(shop?.phone || "").trim();
  const whatsapp = String(shop?.whatsapp || "").trim();
  const website = String(shop?.website || "").trim();
  const addressLower = address.toLowerCase();
  const emailAlreadyInAddress = Boolean(email && address && addressLower.includes(email.toLowerCase()));
  return {
    name,
    address,
    phone: listedPhone || whatsapp,
    email: emailAlreadyInAddress ? "" : email,
    whatsapp: "",
    website,
  };
}

export function formatReceiptDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function maxWidthForSize(size: ReceiptSize) {
  if (size === "thermal58") return 280;
  if (size === "thermal80") return 360;
  return 720;
}

export function whatsappReceiptText(receipt: ReceiptView) {
  const shop = receipt.shop_details?.name || "LaGecto shop";
  const lines = receipt.items
    .map((item) => `• ${item.product_name} x${item.quantity} — $${Number(item.total_price).toFixed(2)}`)
    .join("\n");
  const discount = Number(receipt.discount || 0);
  const contact = uniqueShopContacts(receipt.shop_details);
  const extra = [
    receipt.cashier_name ? `Served by: ${receipt.cashier_name}` : "",
    receipt.time_taken ? `Time taken: ${receipt.time_taken}` : "",
    contact.phone ? `Phone: ${contact.phone}` : "",
    contact.email ? `Email: ${contact.email}` : "",
    contact.website ? `Website: ${contact.website}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `Receipt ${receipt.receipt_number} from ${shop}\nDate: ${formatReceiptDate(receipt.created_at)}\n${lines}\n${discount ? `Discount: $${discount.toFixed(2)}\n` : ""}Total: $${Number(receipt.total).toFixed(2)}\nPayment: ${receipt.payment_method || "cash"} · ${receipt.payment_status || "paid"}\n${extra ? `${extra}\n` : ""}Powered by LaGecto Marketplace`;
}
