import test from "node:test";
import assert from "node:assert/strict";

function computePromoDiscount(input) {
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

function orderTotalAfterDiscounts(subtotal, promotionDiscount, promoDiscount) {
  return Math.max(0, Number(subtotal || 0) - Number(promotionDiscount || 0) - Number(promoDiscount || 0));
}

function normalizePromoCode(code) {
  return String(code || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

test("percent discount respects max and never exceeds subtotal", () => {
  assert.equal(computePromoDiscount({ discountType: "percent", percentOff: 20, eligibleSubtotal: 100 }), 20);
  assert.equal(computePromoDiscount({ discountType: "percent", percentOff: 50, maxDiscount: 10, eligibleSubtotal: 100 }), 10);
  assert.equal(computePromoDiscount({ discountType: "percent", percentOff: 100, eligibleSubtotal: 12.5 }), 12.5);
});

test("fixed discount cannot go negative or past the eligible subtotal", () => {
  assert.equal(computePromoDiscount({ discountType: "fixed", amountOff: 5, eligibleSubtotal: 30 }), 5);
  assert.equal(computePromoDiscount({ discountType: "fixed", amountOff: 50, eligibleSubtotal: 12 }), 12);
  assert.equal(computePromoDiscount({ discountType: "fixed", amountOff: 5, eligibleSubtotal: 0 }), 0);
});

test("free delivery does not invent a cash discount", () => {
  assert.equal(computePromoDiscount({ discountType: "free_delivery", eligibleSubtotal: 40 }), 0);
});

test("order totals never go negative", () => {
  assert.equal(orderTotalAfterDiscounts(40, 10, 50), 0);
  assert.equal(orderTotalAfterDiscounts(40, 5, 5), 30);
});

test("promo codes are normalised server-style", () => {
  assert.equal(normalizePromoCode(" welcome 10 "), "WELCOME10");
});
