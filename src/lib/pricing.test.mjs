import assert from "node:assert/strict";
import test from "node:test";
import { loadEffectivePrices, priceMapFromRpc } from "./pricing.ts";

test("priceMapFromRpc ignores invalid rows and maps sale prices", () => {
  const map = priceMapFromRpc([
    { product_id: "a", list_price: 10, unit_price: 8, on_sale: true },
    { product_id: "", list_price: 1, unit_price: 1 },
    null,
    { product_id: "b", list_price: 5, unit_price: 5 },
  ]);
  assert.equal(map.get("a")?.unitPrice, 8);
  assert.equal(map.get("a")?.onSale, true);
  assert.equal(map.get("b")?.listPrice, 5);
  assert.equal(map.has(""), false);
});

test("loadEffectivePrices batches unique ids and falls back on RPC failure", async () => {
  const ok = await loadEffectivePrices(async () => ({
    data: [{ product_id: "a", list_price: 10, unit_price: 9, on_sale: true }],
    error: null,
  }), ["a", "a", ""]);
  assert.equal(ok.get("a")?.unitPrice, 9);

  const failed = await loadEffectivePrices(async () => ({ data: null, error: new Error("missing") }), ["a"]);
  assert.equal(failed.size, 0);
});
