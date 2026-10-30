/** Display/test helper mirroring public.compute_promo_discount. Checkout never uses this for totals. */

export function computePromoDiscount(input: {
  discountType: "percent" | "fixed" | "free_delivery";
  percentOff?: number | null;
  amountOff?: number | null;
  maxDiscount?: number | null;
  eligibleSubtotal: number;
}) {
  const eligible = Math.max(0, Number(input.eligibleSubtotal || 0));
  if (eligible <= 0) return 0;
  let amount = 0;
  if (input.discountType === "percent") {
    amount = Math.round(eligible * Number(input.percentOff || 0)) / 100;
    amount = Math.round(amount * 100) / 100;
    if (input.maxDiscount != null) amount = Math.min(amount, Number(input.maxDiscount));
  } else if (input.discountType === "fixed") {
    amount = Number(input.amountOff || 0);
  }
  return Math.min(Math.max(amount, 0), eligible);
}

export function normalizePromoCode(code: string) {
  return String(code || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function orderTotalAfterDiscounts(subtotal: number, promotionDiscount: number, promoDiscount: number) {
  return Math.max(0, Number(subtotal || 0) - Number(promotionDiscount || 0) - Number(promoDiscount || 0));
}
