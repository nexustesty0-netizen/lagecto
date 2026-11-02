import assert from "node:assert/strict";
import test from "node:test";
import { barPercent, chartMax, columnPercents, trendLayout } from "./chart-math.ts";

test("chart max never invents a value and keeps zero series readable", () => {
  assert.equal(chartMax([0, 0, 0]), 1);
  assert.equal(chartMax([4, 12, 8]), 12);
  assert.equal(barPercent(0, 10), 0);
  assert.equal(barPercent(5, 10), 50);
  assert.equal(barPercent(1, 100, 8) >= 8, true);
});

test("trend layout stays on the supplied points", () => {
  const layout = trendLayout(
    [
      { label: "Mon", value: 0 },
      { label: "Tue", value: 10 },
      { label: "Wed", value: 5 },
    ],
    100,
    50,
    0,
    0,
  );
  assert.equal(layout.points.length, 3);
  assert.equal(layout.total, 15);
  assert.equal(layout.points[0].y, 50);
  assert.equal(layout.points[1].y, 0);
  assert.equal(layout.points[1].label, "Tue");
});

test("column percents follow the largest real value", () => {
  const cols = columnPercents([
    { label: "Thabi", value: 2 },
    { label: "Kristen", value: 4 },
    { label: "Sandra", value: 0 },
  ]);
  assert.equal(cols[1].percent, 100);
  assert.equal(cols[0].percent, 50);
  assert.equal(cols[2].percent, 0);
});
