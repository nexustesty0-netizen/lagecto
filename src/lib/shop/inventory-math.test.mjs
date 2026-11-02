import assert from "node:assert/strict";
import test from "node:test";
import { inventoryValuation, signedStockDelta, soldQuantities, stockMovementType } from "./inventory-math.ts";

test("stock out cannot invent a positive restock", () => {
  assert.equal(signedStockDelta("out", 4, 10), -4);
  assert.equal(signedStockDelta("in", 4, 10), 4);
  assert.equal(signedStockDelta("set", 0, 7, 5), -2);
});

test("inventory value uses recorded cost only", () => {
  const value = inventoryValuation([
    { stock: 2, cost: 3 },
    { stock: 4, cost: 0 },
    { stock: 1, cost: null },
  ]);
  assert.equal(value.withCost, 6);
  assert.equal(value.missingCostProducts, 2);
  assert.equal(value.units, 7);
});

test("sold quantities stay on real product ids", () => {
  const sold = soldQuantities([
    { product_id: "a", quantity: 2 },
    { product_id: "a", quantity: 1 },
    { product_id: null, quantity: 9 },
  ]);
  assert.equal(sold.a, 3);
  assert.equal(Object.keys(sold).length, 1);
});

test("reason maps onto existing inventory types", () => {
  assert.equal(stockMovementType("restock"), "received");
  assert.equal(stockMovementType("damaged"), "damaged");
  assert.equal(stockMovementType("returned"), "returned");
  assert.equal(stockMovementType("mystery"), "adjustment");
});
