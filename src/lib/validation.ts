export const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._]{1,22}[a-zA-Z0-9]$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SHOP_ID_RE = /^[a-z0-9]+@lg[a-z0-9]+$/i;
export const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,19}$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "lagecto",
  "root",
  "support",
  "system",
  "null",
  "undefined",
  "owner",
  "shop",
  "staff",
  "superadmin",
  "gectotech",
]);

export function normalizeUsername(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (!normalized) return "Username is required.";
  if (normalized.length < 3 || normalized.length > 24) {
    return "Username must be 3 to 24 characters.";
  }
  if (
    !USERNAME_RE.test(normalized) &&
    !(normalized.length === 3 && /^[a-z0-9]{3}$/.test(normalized))
  ) {
    return "Username may only use letters, numbers, dots and underscores.";
  }
  if (normalized.includes("..") || normalized.includes("__")) {
    return "Username cannot contain repeated separators.";
  }
  if (RESERVED.has(normalized)) return "That username is not available.";
  return null;
}

export function validateFullName(value: string) {
  const cleaned = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (cleaned.length < 2) return "Full name is required.";
  if (cleaned.length > 80) return "Full name is too long.";
  if (/<script|javascript:|onerror=/i.test(cleaned)) {
    return "Full name contains invalid characters.";
  }
  return null;
}

export function validateEmail(value: string) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) return "Please enter a valid email address.";
  return null;
}

export function validatePassword(password: string) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include both letters and numbers.";
  }
  return null;
}

export function validatePhone(value: string) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!PHONE_RE.test(raw) || digits.length < 7 || digits.length > 15) {
    return "Enter a valid phone number.";
  }
  return null;
}

export function isShopLoginId(value: string) {
  return SHOP_ID_RE.test(String(value || "").trim());
}

export function looksLikeEmail(value: string) {
  return EMAIL_RE.test(String(value || "").trim());
}

export function usernameChangeReadyAt(lastChangeAt: string | null | undefined) {
  if (!lastChangeAt) return null;
  const next = new Date(lastChangeAt);
  next.setDate(next.getDate() + 14);
  return next;
}
