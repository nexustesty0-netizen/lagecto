import assert from "node:assert/strict";
import test from "node:test";
import { asUuid, chatStartArgs, inboxFallbackName, publicDisplayName, sanitizeInboxItem } from "./chat-privacy.ts";

test("asUuid accepts only real UUIDs", () => {
  assert.equal(asUuid("3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a"), "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a");
  assert.equal(asUuid("not-a-uuid"), null);
  assert.equal(asUuid("'; drop table users; --"), null);
});

test("publicDisplayName never returns emails or raw ids", () => {
  assert.equal(publicDisplayName("Thandi Moyo", "Customer"), "Thandi Moyo");
  assert.equal(publicDisplayName("owner@shop.com", "Shop"), "Shop");
  assert.equal(publicDisplayName("3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a", "Customer"), "Customer");
  assert.equal(publicDisplayName("", "LaGecto"), "LaGecto");
});

test("customers cannot choose another customer or conversation kind", () => {
  const started = chatStartArgs(
    { role: "customer" },
    {
      kind: "shop_customer",
      shopId: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a",
      customerId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      productId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
    },
  );
  assert.deepEqual(started, {
    p_kind: "shop_customer",
    p_shop_id: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a",
    p_customer_id: null,
    p_product_id: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
  });
  assert.equal(chatStartArgs({ role: "customer" }, { kind: "admin_customer", shopId: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a" }), null);
});

test("shop owners can only open their own LaGecto support thread", () => {
  const started = chatStartArgs(
    { role: "shop_owner" },
    { kind: "shop_admin", shopId: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a", customerId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
  );
  assert.deepEqual(started, {
    p_kind: "shop_admin",
    p_shop_id: null,
    p_customer_id: null,
    p_product_id: null,
  });
  assert.equal(chatStartArgs({ role: "shop_owner" }, { kind: "shop_customer", shopId: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a" }), null);
});

test("only Super Admin can pick a shop for support chat", () => {
  const started = chatStartArgs(
    { role: "admin", isSuperAdmin: true },
    { kind: "shop_admin", shopId: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a" },
  );
  assert.equal(started?.p_shop_id, "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a");
  assert.equal(chatStartArgs({ role: "admin", isSuperAdmin: false }, { kind: "shop_admin", shopId: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a" }), null);
});

test("inbox sanitizer strips private fields from display names", () => {
  const item = sanitizeInboxItem(
    {
      id: "3b8c0a1e-4d2f-4a11-9c0b-7e6f5d4c3b2a",
      kind: "shop_customer",
      peer_name: "lagecto@outlook.com",
      last_message_preview: "Hello",
      unread: 2,
    },
    "Customer",
  );
  assert.equal(item.peer_name, "Customer");
  assert.equal(item.unread, 2);
  assert.equal(inboxFallbackName("shop", "shop_admin"), "LaGecto");
  assert.equal(inboxFallbackName("admin", "shop_admin"), "Customer");
});
