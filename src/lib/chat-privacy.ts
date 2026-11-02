export const CHAT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ChatView = "customer" | "shop" | "admin";

export function asUuid(value: unknown): string | null {
  const text = String(value || "").trim();
  return CHAT_UUID_RE.test(text) ? text : null;
}

export function publicDisplayName(value: unknown, fallback: string) {
  const name = String(value || "").trim();
  if (!name || name.includes("@") || CHAT_UUID_RE.test(name)) return fallback;
  return name.slice(0, 80);
}

export function chatViewForRole(role: string | null | undefined, isSuperAdmin = false): ChatView | null {
  if (isSuperAdmin) return "admin";
  if (role === "shop_owner") return "shop";
  if (role === "customer") return "customer";
  return null;
}

export type ChatStartBody = {
  kind?: unknown;
  shopId?: unknown;
  customerId?: unknown;
  productId?: unknown;
};

export function chatStartArgs(
  profile: { role: string; isSuperAdmin?: boolean },
  body: ChatStartBody,
): { p_kind: "shop_customer" | "shop_admin"; p_shop_id: string | null; p_customer_id: null; p_product_id: string | null } | null {
  const kind = String(body.kind || "").trim().toLowerCase();
  const shopId = asUuid(body.shopId);
  const productId = asUuid(body.productId);

  if (profile.isSuperAdmin) {
    if (kind && kind !== "shop_admin") return null;
    return { p_kind: "shop_admin", p_shop_id: shopId, p_customer_id: null, p_product_id: null };
  }

  if (profile.role === "shop_owner") {
    if (kind && kind !== "shop_admin") return null;
    return { p_kind: "shop_admin", p_shop_id: null, p_customer_id: null, p_product_id: null };
  }

  if (profile.role === "customer") {
    if (kind === "shop_admin") {
      return { p_kind: "shop_admin", p_shop_id: null, p_customer_id: null, p_product_id: null };
    }
    if (kind && kind !== "shop_customer") return null;
    if (!shopId) return null;
    return { p_kind: "shop_customer", p_shop_id: shopId, p_customer_id: null, p_product_id: productId };
  }

  return null;
}

export function sanitizeInboxItem(row: Record<string, unknown>, fallbackName: string) {
  return {
    id: String(row.id || ""),
    kind: String(row.kind || ""),
    can_reply: row.can_reply !== false,
    last_message_at: row.last_message_at ? String(row.last_message_at) : null,
    last_message_preview: String(row.last_message_preview || "").slice(0, 80),
    product_name: row.product_name ? publicDisplayName(row.product_name, "") : null,
    product_image: typeof row.product_image === "string" && row.product_image.startsWith("http") ? row.product_image : null,
    peer_name: publicDisplayName(row.peer_name, fallbackName),
    peer_photo: typeof row.peer_photo === "string" && (row.peer_photo.startsWith("http") || row.peer_photo.startsWith("/")) ? row.peer_photo : null,
    unread: Math.max(0, Number(row.unread || 0) || 0),
  };
}

export function inboxFallbackName(view: ChatView, kind: string) {
  if (kind === "shop_admin" && view !== "admin") return "LaGecto";
  if (kind === "admin_customer") return "LaGecto";
  if (view === "customer") return "Shop";
  return "Customer";
}
