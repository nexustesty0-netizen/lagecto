import assert from "node:assert/strict";
import test from "node:test";
import {
  adminNav,
  customerNav,
  filterShopNav,
  groupStartsOpen,
  headerSearchPath,
  isNavActive,
  mobilePrimaryHrefs,
  navHrefs,
  shopNav,
  shopNavLock,
} from "./app-nav.ts";
import { staffPathAllowed } from "./shop/staff.ts";

function shopFor(providerType, staffRole) {
  return filterShopNav(shopNav(), {
    providerType,
    allowed: (href) => staffPathAllowed(staffRole, href),
  });
}

test("each role keeps its own sidebar and existing routes", () => {
  const customer = navHrefs(customerNav());
  const shop = navHrefs(shopNav());
  const admin = navHrefs(adminNav());
  assert.equal(customer.includes("/customer/cart"), true);
  assert.equal(customer.includes("/shop/pos"), false);
  assert.equal(shop.includes("/shop/pos"), true);
  assert.equal(shop.includes("/shop/verification"), true);
  assert.equal(shop.includes("/admin"), false);
  assert.equal(admin.includes("/admin/shops"), true);
  assert.equal(admin.includes("/admin/languages"), true);
  assert.equal(admin.includes("/customer/settings"), false);
});

test("cashiers and managers only see the shop pages they are allowed to open", () => {
  const cashier = navHrefs(shopFor(null, "cashier"));
  const manager = navHrefs(shopFor(null, "manager"));
  const owner = navHrefs(shopFor(null, "owner"));
  assert.deepEqual(cashier.sort(), ["/shop", "/shop/help", "/shop/notifications", "/shop/orders", "/shop/pos", "/shop/receipts", "/shop/sales"].sort());
  assert.equal(manager.includes("/shop/settings"), false);
  assert.equal(manager.includes("/shop/employees"), false);
  assert.equal(manager.includes("/shop/subscription"), false);
  assert.equal(manager.includes("/shop/pos"), true);
  assert.equal(owner.includes("/shop/settings"), true);
  assert.equal(owner.includes("/shop/employees"), true);
});

test("shop catalogue follows provider type without dropping the other role menus", () => {
  const products = navHrefs(shopFor("products", "owner"));
  const services = navHrefs(shopFor("services", "owner"));
  assert.equal(products.includes("/shop/services"), false);
  assert.equal(products.includes("/shop/products"), true);
  assert.equal(services.includes("/shop/inventory"), false);
  assert.equal(services.includes("/shop/services"), true);
});

test("subscription-aware nav marks locked tools but keeps the href", () => {
  assert.equal(shopNavLock("/shop/employees", ["pos", "inventory"]), "package");
  assert.equal(shopNavLock("/shop/employees", ["employees"]), null);
  assert.equal(shopNavLock("/shop/insights", ["pos"], ["analytics"]), "admin");
  assert.equal(shopNav().some((group) => group.items.some((item) => item.href === "/shop/employees")), true);
});

test("More stays closed unless that section is the active page", () => {
  const more = shopNav().find((group) => group.title === "More");
  assert.equal(more?.defaultOpen, false);
  assert.equal(groupStartsOpen(more, "/shop", "/shop"), false);
  assert.equal(groupStartsOpen(more, "/shop/receipts", "/shop"), true);
  assert.equal(isNavActive("/shop/pos", "/shop", "/shop"), false);
  assert.equal(isNavActive("/shop/pos", "/shop/pos", "/shop"), true);
});

test("header search uses an existing page for each role", () => {
  assert.equal(headerSearchPath("customer").action, "/customer/shops");
  assert.equal(headerSearchPath("shop_owner").action, "/shop/sales");
  assert.equal(headerSearchPath("admin").action, "/admin/shops");
  assert.deepEqual(mobilePrimaryHrefs("shop_owner", "cashier"), ["/shop", "/shop/pos", "/shop/orders", "/shop/sales"]);
  assert.equal(mobilePrimaryHrefs("shop_owner", "cashier").includes("/shop/chat"), false);
  assert.deepEqual(mobilePrimaryHrefs("customer"), [
    "/customer",
    "/customer/shops",
    "/customer/cart",
    "/customer/chat",
    "/customer/settings",
  ]);
});
