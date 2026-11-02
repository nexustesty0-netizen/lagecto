function clip(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

export function parseStorefrontEnquiry(body: unknown) {
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const name = clip(row.name, 80);
  const email = clip(row.email, 120);
  const phone = clip(row.phone, 40);
  const subject = clip(row.subject, 120);
  const message = clip(row.message, 2000);
  if (name.length < 2) return { ok: false as const, error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Enter a valid email address." };
  if (phone.replace(/\D/g, "").length < 7) return { ok: false as const, error: "Enter a phone number we can reach." };
  if (subject.length < 3) return { ok: false as const, error: "Add a subject." };
  if (message.length < 10) return { ok: false as const, error: "Add a short message." };
  return { ok: true as const, name, email, phone, subject, message };
}

const hits = new Map<string, number[]>();

export function enquiryAllowed(key: string, limit = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}
