export const PAYMENT_METHODS = ["visa", "mastercard", "ecocash", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "review_required",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["sandbox", "paynow", "cash"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  ecocash: "EcoCash",
  cash: "Cash",
};

export function paymentMethodLabel(method?: string | null) {
  const key = String(method || "").toLowerCase();
  if (key === "whatsapp") return "WhatsApp";
  if (key === "card") return "Card";
  if (key === "transfer" || key === "bank") return "Bank transfer";
  if (key === "other") return "Other";
  if (isPaymentMethod(key)) return PAYMENT_METHOD_LABELS[key];
  return method || "Pending";
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.includes(String(value || "").toLowerCase() as PaymentMethod);
}

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  const method = String(value || "").toLowerCase().trim();
  return isPaymentMethod(method) ? method : null;
}
