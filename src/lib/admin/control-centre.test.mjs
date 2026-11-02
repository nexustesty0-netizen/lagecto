import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryCounts,
  filterAdminCustomers,
  filterAdminProducts,
  filterAdminShops,
  publicCustomerContact,
  registrationGrowth,
  subscriptionBreakdown,
} from "./control-centre.ts";

test("shop search and status filters stay on real rows", () => {
  const shops = [
    { id: "1", name: "Bread House", login_shop_id: "LG-1", status: "active", verification_status: "verified", owner_email: "a@x.com" },
    { id: "2", name: "Salon", login_shop_id: "LG-2", status: "inactive", verification_status: "pending" },
  ];
  assert.equal(filterAdminShops(shops, "bread").length, 1);
  assert.equal(filterAdminShops(shops, "", "inactive").length, 1);
  assert.equal(filterAdminShops(shops, "", "all", "pending").length, 1);
});

test("managers cannot search customers by email", () => {
  const customers = [
    { id: "1", name: "Ada", email: "ada@x.com", username: "ada", account_status: "active" },
    { id: "2", name: "Ben", email: "ben@x.com", username: "ben", account_status: "locked" },
  ];
  assert.equal(filterAdminCustomers(customers, "ada@", "all", false).length, 0);
  assert.equal(filterAdminCustomers(customers, "ada", "all", false).length, 1);
  assert.equal(filterAdminCustomers(customers, "", "locked", true).length, 1);
  assert.equal(publicCustomerContact("ada@x.com", false), null);
  assert.equal(publicCustomerContact("ada@x.com", true), "ada@x.com");
});

test("subscription breakdown never invents package names", () => {
  const breakdown = subscriptionBreakdown(4, [
    { shop_id: "a", package_key: "thabi", status: "active" },
    { shop_id: "a", package_key: "thabi", status: "expired" },
    { shop_id: "b", package_key: "kristen", status: "trial" },
    { shop_id: "c", plan: "Mystery", status: "active" },
  ]);
  assert.equal(breakdown.counts.thabi, 1);
  assert.equal(breakdown.counts.kristen, 1);
  assert.equal(breakdown.counts.other, 1);
  assert.equal(breakdown.withPackage, 3);
  assert.equal(breakdown.withoutPackage, 1);
});

test("growth series only counts the Harare window", () => {
  const now = new Date("2026-10-31T12:00:00+02:00");
  const series = registrationGrowth(
    [
      { created_at: "2026-10-31T08:00:00.000Z" },
      { created_at: "2026-10-31T09:00:00.000Z" },
      { created_at: "2026-10-20T08:00:00.000Z" },
    ],
    now,
    7,
  );
  assert.equal(series.length, 7);
  assert.equal(series.reduce((sum, row) => sum + row.value, 0), 2);
});

test("category and product filters stay on listed rows", () => {
  assert.deepEqual(
    categoryCounts([{ category: "Food" }, { category: "food" }, { category: null }]).map((row) => row.count),
    [2, 1],
  );
  const products = [
    { id: "1", name: "Bread", type: "product", category: "Grocery", shop_name: "House" },
    { id: "2", name: "Cut", type: "service", shop_name: "Salon" },
  ];
  assert.equal(filterAdminProducts(products, "bread").length, 1);
  assert.equal(filterAdminProducts(products, "", "service").length, 1);
});
