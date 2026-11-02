import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { safeNextPath, safePostLoginPath } from "./security.ts";
import { staffCanManage, staffIsOwner, staffPathAllowed } from "./shop/staff.ts";

test("safeNextPath rejects open redirects", () => {
  assert.equal(safeNextPath("/customer"), "/customer");
  assert.equal(safeNextPath("/shop/pos"), "/shop/pos");
  assert.equal(safeNextPath("//evil.com"), "/app");
  assert.equal(safeNextPath("https://evil.com"), "/app");
  assert.equal(safeNextPath("/\\evil.com"), "/app");
  assert.equal(safeNextPath("evil.com"), "/app");
  assert.equal(safeNextPath(null), "/app");
});

test("safePostLoginPath keeps users inside their own area", () => {
  assert.equal(safePostLoginPath("/customer/orders", "/customer"), "/customer/orders");
  assert.equal(safePostLoginPath("/admin", "/customer"), "/customer");
  assert.equal(safePostLoginPath("/shop/settings", "/shop/pos"), "/shop/settings");
  assert.equal(safePostLoginPath("//evil.com", "/customer"), "/customer");
  assert.equal(safePostLoginPath("/shop", "/admin"), "/admin");
});

test("sales mutations require a manager, not a cashier", () => {
  const source = readFileSync(new URL("../app/api/shop/sales/route.ts", import.meta.url), "utf8");
  assert.match(source, /const gate = await requireApiShopManage\(\)/);
  assert.doesNotMatch(source, /await requireApiShop\(\)/);
});

test("cart PUT only forwards product ids and quantities", () => {
  const source = readFileSync(new URL("../app/api/cart/route.ts", import.meta.url), "utf8");
  assert.match(source, /shopId: ""/);
  assert.match(source, /price: 0/);
  assert.match(source, /sync_customer_cart/);
});

test("sales and receipts re-price catalogue lines on the server", () => {
  const sales = readFileSync(new URL("../app/api/shop/sales/route.ts", import.meta.url), "utf8");
  const receipts = readFileSync(new URL("../app/api/shop/receipts/route.ts", import.meta.url), "utf8");
  const pos = readFileSync(new URL("../app/api/shop/pos/route.ts", import.meta.url), "utf8");
  for (const source of [sales, receipts, pos]) {
    assert.match(source, /priceShopTicketItems/);
    assert.match(source, /eq\("shop_id",/);
    assert.match(source, /loadEffectivePrices/);
  }
});

test("checkout never sends client prices to order RPCs", () => {
  const source = readFileSync(new URL("../app/api/orders/checkout/route.ts", import.meta.url), "utf8");
  assert.match(source, /product_id: asCartUuid/);
  assert.match(source, /quantity: normalizeCartQty/);
  assert.doesNotMatch(source, /unit_price/);
  assert.doesNotMatch(source, /p_total/);
});

test("chat realtime listens only to the active conversation", () => {
  const source = readFileSync(new URL("../components/chat/ChatClient.tsx", import.meta.url), "utf8");
  assert.match(source, /conversation_id=eq\.\$\{conversationId\}/);
});

test("notification realtime is scoped to the signed-in user or shop", () => {
  const source = readFileSync(new URL("../components/notifications/NotificationCenter.tsx", import.meta.url), "utf8");
  assert.match(source, /shop_id=eq\.\$\{nextShopId\}/);
  assert.match(source, /user_id=eq\.\$\{nextUserId\}/);
  assert.match(source, /isNoticeUuid/);
  assert.doesNotMatch(source, /window\.alert/);
});

test("cashiers cannot manage catalog, refunds, or staff", () => {
  assert.equal(staffCanManage("cashier"), false);
  assert.equal(staffCanManage("manager"), true);
  assert.equal(staffCanManage("admin"), true);
  assert.equal(staffCanManage("owner"), true);
  assert.equal(staffIsOwner("cashier"), false);
  assert.equal(staffIsOwner("owner"), true);
  assert.equal(staffPathAllowed("cashier", "/shop/pos"), true);
  assert.equal(staffPathAllowed("cashier", "/shop/catalog"), false);
  assert.equal(staffPathAllowed("cashier", "/shop/settings"), false);
  assert.equal(staffPathAllowed("manager", "/shop/settings"), false);
  assert.equal(staffPathAllowed("manager", "/shop/sales"), true);
  assert.equal(staffPathAllowed("owner", "/shop/settings"), true);
  assert.equal(staffPathAllowed("cashier", "/shop/chat"), false);
  assert.equal(staffPathAllowed("cashier", "/shop/service-requests"), false);
  assert.equal(staffPathAllowed("cashier", "/shop/service-requests/abc"), true);
  assert.equal(staffPathAllowed("manager", "/shop/chat"), true);
});

test("shop support chat is Super Admin only", () => {
  const source = readFileSync(new URL("./admin-access.ts", import.meta.url), "utf8");
  assert.match(source, /SUPER_ADMIN_ONLY_PATHS[\s\S]*\/admin\/chat/);
});

test("managers can review shops and customers but not contacts or restrictions", () => {
  const source = readFileSync(new URL("./admin-access.ts", import.meta.url), "utf8");
  const minBlock = source.slice(source.indexOf("const ADMIN_MIN_PATHS"), source.indexOf("export function canViewAccountContact"));
  assert.match(minBlock, /\/admin\/settings/);
  assert.doesNotMatch(minBlock, /\/admin\/shops\//);
  assert.match(source, /export function canViewAccountContact/);
  assert.match(source, /export function canRestrictAccounts/);
});
