import type { CartItem } from "@/lib/types";

export const CART_MAX_QTY = 99;
export const CART_LOW_STOCK_FALLBACK = 5;

export type CartLineStatus = "ok" | "unavailable" | "insufficient_stock";

export function asCartUuid(value: unknown): string | null {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

export function normalizeCartQty(value: unknown) {
  const qty = Math.floor(Number(value));
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.min(CART_MAX_QTY, qty);
}

export function capCartQuantity(
  quantity: unknown,
  stock?: number | null,
  type?: string | null,
  availability?: string | null,
) {
  const qty = normalizeCartQty(quantity);
  if (!qty) return 0;
  if (type === "service" || availability === "on_order") return qty;
  if (stock == null || !Number.isFinite(Number(stock))) return qty;
  return Math.min(qty, Math.max(0, Math.floor(Number(stock))));
}

export function mergeCartItems(local: CartItem[], remote: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of [...remote, ...local]) {
    const productId = asCartUuid(item.productId);
    const shopId = asCartUuid(item.shopId);
    if (!productId || !shopId) continue;
    const quantity = normalizeCartQty(item.quantity);
    if (!quantity) continue;
    const existing = map.get(productId);
    if (!existing) {
      map.set(productId, {
        productId,
        shopId,
        shopName: String(item.shopName || "Shop").slice(0, 80),
        name: String(item.name || "Product").slice(0, 160),
        price: Math.max(0, Number(item.price) || 0),
        quantity,
        image: item.image || null,
        type: item.type === "service" ? "service" : "product",
        availability: item.availability === "on_order" ? "on_order" : "available",
      });
      continue;
    }
    map.set(productId, {
      ...existing,
      shopName: existing.shopName || item.shopName,
      name: existing.name || item.name,
      image: existing.image || item.image,
      quantity: Math.min(CART_MAX_QTY, Math.max(existing.quantity, quantity)),
    });
  }
  return [...map.values()];
}

export function groupCartByShop(items: CartItem[]) {
  const map = new Map<string, { shopId: string; shopName: string; items: CartItem[] }>();
  for (const item of items) {
    const group = map.get(item.shopId) || { shopId: item.shopId, shopName: item.shopName || "Shop", items: [] };
    group.items.push(item);
    if (item.shopName) group.shopName = item.shopName;
    map.set(item.shopId, group);
  }
  return [...map.values()];
}

export function pricesDiffer(listed: number, live: number) {
  return Math.abs(Number(listed || 0) - Number(live || 0)) >= 0.01;
}

export function isLowStock(stock: number | null | undefined, type?: string | null, availability?: string | null) {
  if (type === "service" || availability === "on_order") return false;
  if (stock == null || !Number.isFinite(Number(stock))) return false;
  const qty = Number(stock);
  return qty > 0 && qty <= CART_LOW_STOCK_FALLBACK;
}

export function lineCanCheckout(status: CartLineStatus | string | null | undefined) {
  return status === "ok" || status === "on_order" || !status;
}

export function shopSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.price) || 0) * item.quantity, 0);
}

export function cartPayload(items: CartItem[]) {
  return items
    .map((item) => ({
      product_id: asCartUuid(item.productId),
      quantity: normalizeCartQty(item.quantity),
    }))
    .filter((item): item is { product_id: string; quantity: number } => Boolean(item.product_id && item.quantity > 0))
    .slice(0, 80);
}
