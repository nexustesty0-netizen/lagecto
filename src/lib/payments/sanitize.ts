const SENSITIVE_KEYS = /^(cvv|cvc|pin|password|secret|token|pan|card_number|cardnumber|ecocash_pin|integration_key)$/i;
const DIGIT_RUN = /\d{13,19}/g;

export function sanitizePaymentMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (typeof raw === "string") {
      out[key] = raw.replace(DIGIT_RUN, "[redacted]").slice(0, 240);
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      out[key] = raw;
    }
  }
  return out;
}

export function maskInstrument(value: string | null | undefined) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length >= 4) return `•••• ${digits.slice(-4)}`;
  return text.slice(0, 24);
}
