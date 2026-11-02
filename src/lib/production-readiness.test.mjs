import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("signed-in cart persistence only syncs product ids and quantities", () => {
  const cart = source("../components/cart/useCart.ts");
  assert.match(cart, /localStorage\.setItem\(KEY/);
  assert.match(cart, /fetch\("\/api\/cart"/);
  assert.match(cart, /items: next\.map\(\(item\) => \(\{ productId: item\.productId, quantity: item\.quantity \}\)\)/);
});

test("POS duplicate taps reuse a bounded idempotency key", () => {
  const pos = source("../app/api/shop/pos/route.ts");
  const client = source("../components/shop/PosClient.tsx");
  assert.match(pos, /p_idempotency_key: normalizeIdempotencyKey/);
  assert.match(client, /idempotencyKey: attemptKey\.current/);
});

test("inventory and POS stay on the session shop, not a body shop id", () => {
  const inventory = source("../app/api/shop/inventory/adjust/route.ts");
  const pos = source("../app/api/shop/pos/route.ts");
  assert.match(inventory, /eq\("shop_id", auth\.shop\.id\)/);
  assert.match(pos, /p_shop_id: shop\.id/);
  assert.doesNotMatch(pos, /p_shop_id: body\.shopId/);
});

test("enquiries and bookings require a signed-in customer id", () => {
  const actions = source("../components/customer/ShopActions.tsx");
  assert.match(actions, /service_requests/);
  assert.match(actions, /service_bookings/);
  assert.match(actions, /customer_id: user\?\.id/);
  assert.match(actions, /if \(!user\)/);
  assert.match(actions, /login\?next=/);
});

test("receipts and sales cannot take a foreign shop catalogue price", () => {
  const sql = source("../../supabase/migrations/20261031210000_security_data_integrity.sql");
  assert.match(sql, /p_lock_catalog_price BOOLEAN DEFAULT TRUE/);
  assert.match(sql, /One of the items is not sold by this shop/);
  assert.match(sql, /trusted_customer_id/);
});

test("app sidebar is solid brand green with no gradient", () => {
  const css = source("../app/globals.css");
  const block = css.slice(css.indexOf(".app-sidebar {"), css.indexOf(".app-nav-scroll"));
  assert.match(block, /background:\s*#0B6E4F/i);
  assert.doesNotMatch(block, /linear-gradient|radial-gradient/);
});

test("storefront home uses the shop banner with a shop-colour blend, not a black overlay", () => {
  const home = source("../components/storefront/tech/TechHome.tsx");
  const hero = source("../components/storefront/tech/TechHero.tsx");
  const chrome = source("../components/storefront/StorefrontChrome.tsx");
  assert.match(home, /TechHero/);
  assert.match(hero, /--sf-primary/);
  assert.match(hero, /linear-gradient/);
  assert.doesNotMatch(hero, /from-black|bg-black/);
  assert.doesNotMatch(chrome, /from-black/);
});

test("customer dashboard uses a photo hero with solid green copy", () => {
  const page = source("../app/customer/page.tsx");
  const hero = source("../components/ui/primitives.tsx");
  assert.match(page, /DashboardHero/);
  assert.match(page, /image="\/marketplace\/shops-hero.png"/);
  assert.match(hero, /bg-\[#0B6E4F\]/);
  assert.doesNotMatch(hero.slice(hero.indexOf("export function DashboardHero"), hero.indexOf("export function PeriodChips")), /bg-gradient|linear-gradient|from-black/);
});

test("storefront media and maps are not blocked by CSP", () => {
  const csp = source("./security.ts");
  assert.match(csp, /img-src 'self' data: blob: https:/);
  assert.match(csp, /script-src[^;]*connect\.facebook\.net/);
  assert.match(csp, /frame-src[^;]*openstreetmap\.org/);
  assert.match(csp, /frame-src[^;]*facebook\.com/);
  assert.doesNotMatch(csp, /maps\.google\.com/);
  const map = source("./storefront/map.ts");
  assert.match(map, /openstreetmap\.org\/export\/embed/);
  assert.doesNotMatch(map, /output=embed/);
  assert.match(map, /Bulawyo/);
});

test("storefront services are labelled Services, not listed in writing", () => {
  const list = source("../components/storefront/StorefrontCatalogList.tsx");
  assert.doesNotMatch(list, /Listed in writing/i);
  const home = source("../components/storefront/tech/TechHome.tsx");
  assert.match(home, />Services</);
});

test("storefronts expose a Marketplace button back to the catalogue", () => {
  const chrome = source("../components/storefront/tech/TechChrome.tsx");
  assert.match(chrome, /href="\/marketplace"/);
  assert.match(chrome, />\s*Marketplace\s*</);
});

test("touch targets and the viewport stay phone-usable", () => {
  const css = source("../app/globals.css");
  const layout = source("../app/layout.tsx");
  assert.match(css, /--lg-control: 44px/);
  assert.match(css, /overflow-x: clip/);
  assert.match(layout, /width: "device-width"/);
});

test("marketplace filters stack on a phone instead of overlapping", () => {
  const page = source("../app/(public)/marketplace/page.tsx");
  assert.match(page, /grid-cols-1 gap-3/);
  assert.match(page, /sm:contents/);
  assert.match(page, /w-full min-w-0 max-w-full/);
  assert.doesNotMatch(page, /grid-cols-2 gap-3 rounded/);
  assert.doesNotMatch(page, /Products & services/);
});

test("shops All is a flat list and a category chip shows that category only", () => {
  const page = source("../app/(public)/shops/page.tsx");
  assert.match(page, /All shops/);
  assert.match(page, /categoryLabel\(activeCategory\)/);
  assert.match(page, /getPublicShops\(\{ q, category \}\)/);
  assert.doesNotMatch(page, /groupShopsByCategory/);
});

test("package prices and names stay the published Thabi Kristen Sandra matrix", () => {
  const packages = source("./packages.ts");
  assert.match(packages, /thabi/);
  assert.match(packages, /kristen/);
  assert.match(packages, /sandra/);
  assert.doesNotMatch(packages, /nomvula/i);
});
