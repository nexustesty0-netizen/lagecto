const SECRET_PATTERN =
  /(password|passwd|secret|token|authorization|api[_-]?key|service[_-]?role|refresh_token|access_token|cookie|bearer)/i;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+/g;
const URL_SECRET_PATTERN = /([?&](?:token|key|code|password|secret|access_token)=)[^&\s]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\+?\d[\d\s()-]{8,}\d/g;
const UUID_QUERY_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function redactSensitive(value: string) {
  return value
    .replace(JWT_PATTERN, "[redacted-token]")
    .replace(URL_SECRET_PATTERN, "$1[redacted]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .replace(UUID_QUERY_PATTERN, "[redacted-id]");
}

function digestOf(error: unknown) {
  if (error && typeof error === "object" && "digest" in error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === "string" && digest ? digest : "";
  }
  return "";
}

const TECHNICAL = /sql|postgres|permission denied|column |relation |violates |schema cache|stack|exception|null value/i;

export function publicRpcMessage(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  if (!text || TECHNICAL.test(text)) return fallback;
  return text.slice(0, 180);
}

export type LogLevel = "error" | "warn" | "info";

export function requestIdFrom(headers?: Headers | null) {
  const incoming = headers?.get("x-request-id")?.trim();
  if (incoming && incoming.length <= 80 && /^[A-Za-z0-9._-]+$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}

export function logEvent(
  level: LogLevel,
  scope: string,
  details?: { requestId?: string; message?: string; error?: unknown },
) {
  const digest = details?.error ? digestOf(details.error) : "";
  const name = details?.error instanceof Error ? details.error.name : undefined;
  const rawMessage =
    details?.message ||
    (details?.error instanceof Error ? details.error.message : typeof details?.error === "string" ? details.error : "");
  const message = SECRET_PATTERN.test(rawMessage) ? "[redacted]" : redactSensitive(String(rawMessage || "")).slice(0, 300);
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope: `lagecto:${scope}`,
    requestId: details?.requestId,
    digest: digest || undefined,
    name,
    message: message || undefined,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logAppError(scope: string, error: unknown, requestId?: string) {
  logEvent("error", scope, { error, requestId });
}
