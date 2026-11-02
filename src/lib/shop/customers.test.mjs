import assert from "node:assert/strict";
import test from "node:test";
import { groupShopCustomers, shopCustomerKey } from "./customers.ts";

test("customers group by real identity and do not keep raw emails as names", () => {
  const grouped = groupShopCustomers([
    {
      customer_id: "11111111-1111-4111-8111-111111111111",
      customer_name: "Ada",
      customer_email: "ada@example.com",
      total: 10,
      kind: "order",
      id: "o1",
      created_at: "2026-10-01",
    },
    {
      customer_id: "11111111-1111-4111-8111-111111111111",
      customer_name: "Ada",
      total: 4,
      kind: "sale",
      id: "s1",
      created_at: "2026-10-02",
    },
    { customer_email: "not-an-email", customer_name: "ada@hidden.com", kind: "order", id: "skip" },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].orders, 1);
  assert.equal(grouped[0].sales, 1);
  assert.equal(grouped[0].spent, 14);
  assert.equal(grouped[0].name, "Ada");
  assert.equal(grouped[0].email, "ada@example.com");
});

test("guest keys never use a missing identity", () => {
  assert.equal(shopCustomerKey({}), "");
  assert.match(shopCustomerKey({ customer_email: "Pat@Shop.com" }), /^em_pat@shop.com$/);
});
