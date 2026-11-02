import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAuthorisedDiscount,
  filterPosCatalog,
  mapShopTicketItems,
  matchPosBarcode,
  MAX_CUSTOM_UNIT_PRICE,
  normalizeIdempotencyKey,
  posAllowsQty,
  posCatalogUnitPrice,
  posCategories,
  posDailySummary,
  posTicketTotals,
  priceShopTicketItems,
  resolvePosApiItems,
} from "./pos.ts";

const bread = {
  id: "a",
  name: "Bread",
  price: 10,
  stock: 4,
  type: "product",
  barcode: "12345",
  category: "Grocery",
  availability: "available",
  is_available: true,
  effective_price: 8,
};
const haircut = {
  id: "b",
  name: "Haircut",
  price: 15,
  stock: 0,
  type: "service",
  category: "Salon",
  is_available: true,
};
const cake = {
  id: "c",
  name: "Cake",
  price: 20,
  stock: 0,
  type: "product",
  availability: "on_order",
  category: "Bakery",
  is_available: true,
};

test("catalog unit price prefers the live promo", () => {
  assert.equal(posCatalogUnitPrice(bread), 8);
  assert.equal(posCatalogUnitPrice({ id: "x", name: "X", price: 3 }), 3);
});

test("stocked goods cannot oversell; services and on-order can", () => {
  assert.equal(posAllowsQty(bread, 4), true);
  assert.equal(posAllowsQty(bread, 5), false);
  assert.equal(posAllowsQty(haircut, 9), true);
  assert.equal(posAllowsQty(cake, 3), true);
});

test("search matches name, barcode, and category chips", () => {
  const products = [bread, haircut, cake];
  assert.equal(filterPosCatalog(products, "bre").map((row) => row.id).join(), "a");
  assert.equal(filterPosCatalog(products, "12345").map((row) => row.id).join(), "a");
  assert.equal(filterPosCatalog(products, "", "salon").map((row) => row.id).join(), "b");
  assert.equal(matchPosBarcode(products, "12345")?.id, "a");
  assert.equal(matchPosBarcode(products, "bread"), null);
  assert.deepEqual(
    posCategories(products).map((row) => row.key),
    ["bakery", "grocery", "salon"],
  );
});

test("ticket totals keep promo discount off the charged total", () => {
  const totals = posTicketTotals([
    { listPrice: 10, unitPrice: 8, quantity: 2 },
    { listPrice: 5, unitPrice: 5, quantity: 1 },
  ]);
  assert.equal(totals.listSubtotal, 25);
  assert.equal(totals.charged, 21);
  assert.equal(totals.promoDiscount, 4);
});

test("authorised extra discount is manager-only and cannot go below zero", () => {
  assert.deepEqual(applyAuthorisedDiscount(21, 5, false), { extra: 0, total: 21 });
  assert.deepEqual(applyAuthorisedDiscount(21, 5, true), { extra: 5, total: 16 });
  assert.deepEqual(applyAuthorisedDiscount(21, 40, true), { extra: 21, total: 0 });
});

test("daily summary counts completed Harare-day sales only", () => {
  const now = new Date("2026-10-31T12:00:00+02:00");
  const summary = posDailySummary(
    [
      { total: 10, status: "completed", sale_date: "2026-10-31T08:00:00.000Z", payment_method: "cash" },
      { total: 4, status: "cancelled", sale_date: "2026-10-31T09:00:00.000Z", payment_method: "cash" },
      { total: 7, status: "completed", sale_date: "2026-10-30T08:00:00.000Z", payment_method: "ecocash" },
      { total: 3, status: "completed", sale_date: "2026-10-31T10:00:00.000Z", payment_method: "ecocash" },
    ],
    now,
  );
  assert.equal(summary.count, 2);
  assert.equal(summary.total, 13);
  assert.equal(summary.byMethod.cash, 10);
  assert.equal(summary.byMethod.ecocash, 3);
});

test("API resolver uses server prices and rejects overselling catalog lines", () => {
  const prices = new Map([["a", { unitPrice: 8, listPrice: 10, onSale: true }]]);
  const ok = resolvePosApiItems(
    [
      { product_id: "a", name: "hacked", quantity: 2, unit_price: 1 },
      { product_id: null, name: "Repair", quantity: 1, unit_price: 12 },
    ],
    [bread],
    prices,
  );
  assert.equal(ok.error, undefined);
  assert.equal(ok.items?.[0].unit_price, 8);
  assert.equal(ok.items?.[0].name, "Bread");
  assert.equal(ok.items?.[1].unit_price, 12);

  const oversell = resolvePosApiItems(
    [{ product_id: "a", name: "Bread", quantity: 9, unit_price: 8 }],
    [bread],
    prices,
  );
  assert.match(String(oversell.error), /enough stock/);

  const foreign = resolvePosApiItems(
    [{ product_id: "other-shop", name: "Stolen", quantity: 1, unit_price: 1 }],
    [bread],
    prices,
  );
  assert.match(String(foreign.error), /no longer for sale/);

  const huge = resolvePosApiItems(
    [{ product_id: null, name: "Repair", quantity: 1, unit_price: MAX_CUSTOM_UNIT_PRICE + 1 }],
    [bread],
    prices,
  );
  assert.match(String(huge.error), /too large/);
});

test("ticket mapper and loader ignore client catalogue prices", async () => {
  const mapped = mapShopTicketItems([{ productId: "a", name: "hacked", quantity: 2, unitPrice: 1 }]);
  assert.equal(mapped[0].product_id, "a");
  const priced = await priceShopTicketItems(
    mapped,
    async () => [bread],
    async () => new Map([["a", { unitPrice: 8, listPrice: 10, onSale: true }]]),
  );
  assert.equal(priced.error, undefined);
  assert.equal(priced.items?.[0].unit_price, 8);
  assert.equal(priced.items?.[0].name, "Bread");
});

test("idempotency keys stay a bounded token", () => {
  assert.equal(normalizeIdempotencyKey("short"), null);
  assert.equal(normalizeIdempotencyKey("a".repeat(81)), null);
  assert.equal(normalizeIdempotencyKey("  pos-sale-12345  "), "pos-sale-12345");
});
