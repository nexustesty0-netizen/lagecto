import assert from "node:assert/strict";
import test from "node:test";
import { rankBestSellers, weekSalesSeries } from "./dashboard-math.ts";

test("best sellers stay inside completed sale lines and do not invent products", () => {
  const ranked = rankBestSellers(
    [
      {
        sale_items: [
          { product_id: "a", product_name: "Bread", quantity: 2 },
          { product_id: "b", product_name: "Milk", quantity: 1 },
        ],
      },
      { sale_items: [{ product_id: "a", product_name: "Bread", quantity: 3 }] },
      { sale_items: [{ product_id: "c", product_name: "Skip", quantity: 0 }] },
    ],
    5,
  );
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, "a");
  assert.equal(ranked[0].quantity, 5);
  assert.equal(ranked[1].id, "b");
});

test("week sales only count dates in the last seven Harare days", () => {
  const now = new Date("2026-10-31T12:00:00+02:00");
  const series = weekSalesSeries(
    [
      { total: 10, sale_date: "2026-10-31T08:00:00.000Z" },
      { total: 4, sale_date: "2026-10-20T08:00:00.000Z" },
    ],
    now,
  );
  assert.equal(series.length, 7);
  assert.equal(
    series.reduce((sum, row) => sum + row.value, 0),
    10,
  );
});
