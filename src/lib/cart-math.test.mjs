import assert from "node:assert/strict";
import test from "node:test";
import {
  capCartQuantity,
  cartPayload,
  groupCartByShop,
  mergeCartItems,
  pricesDiffer,
  isLowStock,
  shopSubtotal,
} from "./cart-math.ts";

const shopA = "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a";
const shopB = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const productA = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const productB = "cccccccc-dddd-4eee-8fff-000000000000";

test("quantities never exceed stock for in-stock goods", () => {
  assert.equal(capCartQuantity(8, 3, "product", "available"), 3);
  assert.equal(capCartQuantity(2, 10, "product", "available"), 2);
  assert.equal(capCartQuantity(8, 0, "product", "available"), 0);
  assert.equal(capCartQuantity(8, 1, "product", "on_order"), 8);
  assert.equal(capCartQuantity(8, 0, "service", "available"), 8);
});

test("merge keeps one row per product and does not invent shops", () => {
  const merged = mergeCartItems(
    [{ productId: productA, shopId: shopA, shopName: "Shop A", name: "Bread", price: 2, quantity: 1 }],
    [{ productId: productA, shopId: shopA, shopName: "Shop A", name: "Bread", price: 2.5, quantity: 3 }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].quantity, 3);
  assert.equal(merged[0].shopId, shopA);
});

test("server cart payload drops client prices and shop ids", () => {
  const payload = cartPayload([
    { productId: productA, shopId: shopA, shopName: "Shop A", name: "Bread", price: 99, quantity: 2 },
    { productId: "not-a-uuid", shopId: shopA, shopName: "Shop A", name: "Bad", price: 1, quantity: 1 },
  ]);
  assert.deepEqual(payload, [{ product_id: productA, quantity: 2 }]);
});

test("cart groups stay shop-scoped", () => {
  const groups = groupCartByShop([
    { productId: productA, shopId: shopA, shopName: "Shop A", name: "Bread", price: 2, quantity: 2 },
    { productId: productB, shopId: shopB, shopName: "Shop B", name: "Milk", price: 1, quantity: 1 },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(shopSubtotal(groups[0].items), groups[0].shopId === shopA ? 4 : 1);
  assert.equal(pricesDiffer(2, 2.5), true);
  assert.equal(pricesDiffer(2, 2), false);
  assert.equal(isLowStock(2, "product", "available"), true);
  assert.equal(isLowStock(20, "product", "available"), false);
});
