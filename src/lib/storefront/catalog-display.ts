function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function catalogDeliveryNote(
  itemDelivery?: string | null,
  shopDelivery?: string | null,
  pickupOnly?: boolean,
) {
  if (pickupOnly) return "Pickup only";
  const time = String(itemDelivery || "").trim() || String(shopDelivery || "").trim();
  return time ? `Average delivery: ${time}` : null;
}

export function catalogPriceLabel(amount?: number | null) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "Contact shop for pricing";
  return money(value);
}

export function catalogTimeframeLabel(
  kind: "product" | "service" | undefined,
  itemDelivery?: string | null,
  shopDelivery?: string | null,
  pickupOnly?: boolean,
) {
  if (kind === "service") {
    const time = String(itemDelivery || "").trim() || String(shopDelivery || "").trim();
    return time ? `Estimated completion: ${time}` : "Timeframe provided on enquiry";
  }
  return catalogDeliveryNote(itemDelivery, shopDelivery, pickupOnly);
}
