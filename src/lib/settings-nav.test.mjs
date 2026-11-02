import assert from "node:assert/strict";
import test from "node:test";
import {
  adminSettingTabs,
  adminSettingsLinks,
  customerSettingTabs,
  pickSettingsTab,
  shopCatalogueLinks,
  shopSettingTabs,
  shopSellingLinks,
} from "./settings-nav.ts";

test("unknown settings tabs fall back to the first category", () => {
  const tabs = customerSettingTabs();
  assert.equal(pickSettingsTab(tabs, "privacy"), "privacy");
  assert.equal(pickSettingsTab(tabs, "nope"), "profile");
  assert.equal(pickSettingsTab(tabs, ""), "profile");
});

test("customer settings include preferences without inventing a language switcher", () => {
  const ids = customerSettingTabs().map((tab) => tab.id);
  assert.deepEqual(ids, ["profile", "security", "notifications", "privacy", "preferences", "account"]);
});

test("shop catalogue links follow the shop provider type", () => {
  assert.equal(shopCatalogueLinks("products").some((row) => row.href === "/shop/services"), false);
  assert.equal(shopCatalogueLinks("services").some((row) => row.href === "/shop/inventory"), false);
  assert.equal(shopCatalogueLinks("both").length, 3);
  assert.equal(shopSellingLinks().some((row) => row.href === "/shop/pos"), true);
  assert.equal(shopSellingLinks().some((row) => row.href === "/shop/promotions"), true);
  assert.equal(shopSettingTabs()[0].id, "profile");
});

test("admin settings hide platform, branding, and audit tools from non-super admins", () => {
  const admin = adminSettingTabs(false).map((tab) => tab.id);
  const superAdmin = adminSettingTabs(true).map((tab) => tab.id);
  assert.equal(admin.includes("platform"), false);
  assert.equal(admin.includes("security"), false);
  assert.equal(superAdmin.includes("platform"), true);
  assert.equal(superAdmin.includes("security"), true);
  assert.equal(adminSettingsLinks(false).branding.length, 0);
  assert.equal(adminSettingsLinks(true).security[0].href, "/admin/security");
});
