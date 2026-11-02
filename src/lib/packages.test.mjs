import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogDeviceImageLimit,
  catalogDeviceImageMessage,
  featuresForPackage,
  isPaidPackage,
  normalizePackageKey,
  PACKAGE_PRICES,
  packageRequiredFor,
} from "./packages.ts";

test("published package prices are unchanged", () => {
  assert.equal(PACKAGE_PRICES.thabi["1_month"], 4.5);
  assert.equal(PACKAGE_PRICES.thabi["1_year"], 38);
  assert.equal(PACKAGE_PRICES.kristen["1_month"], 6.5);
  assert.equal(PACKAGE_PRICES.kristen["1_year"], 55);
  assert.equal(PACKAGE_PRICES.sandra["1_month"], 8);
  assert.equal(PACKAGE_PRICES.sandra["1_year"], 67);
});

test("package names stay Thabi, Kristen, and Sandra", () => {
  assert.equal(normalizePackageKey("thabi"), "thabi");
  assert.equal(normalizePackageKey("kristen"), "kristen");
  assert.equal(normalizePackageKey("sandra"), "sandra");
  assert.equal(normalizePackageKey("nomvula"), "free");
  assert.equal(isPaidPackage("free"), false);
  assert.equal(isPaidPackage("thabi"), true);
});

test("Free currently includes every shop tool; paid packages keep their intended matrix", () => {
  assert.equal(packageRequiredFor("employees"), "free");
  assert.equal(packageRequiredFor("pos"), "free");
  assert.equal(featuresForPackage("free").has("employees"), true);
  assert.equal(featuresForPackage("thabi").has("employees"), false);
  assert.equal(featuresForPackage("kristen").has("employees"), true);
  assert.equal(featuresForPackage("sandra").has("analytics"), true);
});

test("device catalog photos are capped by package to save storage", () => {
  assert.equal(catalogDeviceImageLimit("free"), 4);
  assert.equal(catalogDeviceImageLimit("thabi"), 8);
  assert.equal(catalogDeviceImageLimit("kristen"), 10);
  assert.equal(catalogDeviceImageLimit("sandra"), null);
  assert.match(catalogDeviceImageMessage("free"), /4 service or product photos/);
  assert.match(catalogDeviceImageMessage("sandra"), /unlimited/);
});
