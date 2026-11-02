export type ProductAvailability = "available" | "on_order";

export function normalizeAvailability(value?: string | null): ProductAvailability {
  return value === "on_order" ? "on_order" : "available";
}

export function isOnOrder(value?: string | null) {
  return normalizeAvailability(value) === "on_order";
}

export function availabilityLabel(value?: string | null) {
  return isOnOrder(value) ? "Available on order" : "Available now";
}

export function availabilityDetail(value?: string | null, stock?: number | null, type?: string | null) {
  if (type === "service") return "";
  if (isOnOrder(value)) return "Available on order";
  const qty = Number(stock || 0);
  if (qty > 0) return qty === 1 ? "Available · 1 in stock" : `Available · ${qty} in stock`;
  return "Out of stock";
}
