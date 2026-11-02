import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isNoindexPath, NOINDEX_PATH_PREFIXES, SITEMAP_PATHS } from "./seo-paths.mjs";

test("private dashboards are marked noindex", () => {
  assert.equal(isNoindexPath("/customer"), true);
  assert.equal(isNoindexPath("/customer/orders"), true);
  assert.equal(isNoindexPath("/shop/pos"), true);
  assert.equal(isNoindexPath("/admin/users"), true);
  assert.equal(isNoindexPath("/api/health"), true);
  assert.equal(isNoindexPath("/cart"), true);
  assert.equal(isNoindexPath("/"), false);
  assert.equal(isNoindexPath("/marketplace"), false);
  assert.equal(isNoindexPath("/s/demo-shop"), false);
  assert.equal(isNoindexPath("/shops"), false);
  assert.ok(NOINDEX_PATH_PREFIXES.includes("/admin"));
});

test("sitemap lists public legal and marketing pages, not dashboards", () => {
  assert.ok(SITEMAP_PATHS.includes("/support/terms"));
  assert.ok(SITEMAP_PATHS.includes("/support/privacy"));
  assert.ok(SITEMAP_PATHS.includes("/support/rules"));
  assert.ok(SITEMAP_PATHS.includes("/register-shop"));
  assert.ok(!SITEMAP_PATHS.includes("/admin"));
  assert.ok(!SITEMAP_PATHS.includes("/shop"));
  assert.ok(!SITEMAP_PATHS.includes("/customer"));
  assert.ok(!SITEMAP_PATHS.includes("/login"));
});

test("legal fallbacks exist and do not claim certification", () => {
  const legal = readFileSync(new URL("./legal-fallback.ts", import.meta.url), "utf8");
  assert.doesNotMatch(legal, /operating statement/i);
  assert.doesNotMatch(legal, /certified legal opinion/i);
  assert.match(legal, /WhatsApp/);
  assert.match(legal, /Session cookies/);
  assert.match(legal, /Marketplace rules/);
  assert.doesNotMatch(legal, /GDPR certified|ISO 27001|PCI DSS/);
});

test("search JSON-LD stays on the marketplace", () => {
  const seo = readFileSync(new URL("./seo.ts", import.meta.url), "utf8");
  assert.match(seo, /\/marketplace\?q=\{search_term_string\}/);
  assert.match(seo, /"@type": "WebSite"/);
});
