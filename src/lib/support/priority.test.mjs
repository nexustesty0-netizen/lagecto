import assert from "node:assert/strict";
import test from "node:test";
import { capSupportPriority } from "./priority-math.mjs";

test("urgent is only kept for payment, security and account", () => {
  assert.equal(capSupportPriority("payment", "urgent"), "urgent");
  assert.equal(capSupportPriority("security", "urgent"), "urgent");
  assert.equal(capSupportPriority("loyalty", "urgent"), "high");
  assert.equal(capSupportPriority("other", "normal"), "normal");
});
