const FALLBACK_NEXT = "/app";

export function safeNextPath(next: string | null | undefined, fallback = FALLBACK_NEXT) {
  if (!next) return fallback;
  const value = next.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /:\/\//.test(value)) {
    return fallback;
  }
  return value;
}

const PRIVATE_ROOTS = ["/customer", "/shop", "/admin"] as const;

export function safePostLoginPath(next: string | null | undefined, home: string) {
  const destination = home.startsWith("/") ? home : FALLBACK_NEXT;
  const requested = safeNextPath(next, destination);
  const homeRoot = PRIVATE_ROOTS.find((root) => destination === root || destination.startsWith(`${root}/`));
  if (!homeRoot) return destination;
  if (requested === homeRoot || requested.startsWith(`${homeRoot}/`)) return requested;
  return destination;
}

export function isHttpsRequest(request: { nextUrl?: { protocol?: string }; headers: Headers }) {
  if (request.nextUrl?.protocol === "https:") return true;
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return process.env.NODE_ENV === "production";
}

export function authCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };
}

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
  "connect-src 'self' https: wss://*.supabase.co wss://*.supabase.in",
  "frame-src 'self' https://www.openstreetmap.org https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.instagram.com https://www.tiktok.com https://www.facebook.com https://web.facebook.com https://m.facebook.com https://*.facebook.com",
].join("; ");

export function applySecurityHeaders(headers: Headers, options?: { hsts?: boolean }) {
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-DNS-Prefetch-Control", "off");
  if (options?.hsts) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}
