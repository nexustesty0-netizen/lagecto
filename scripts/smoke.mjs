/**
 * HTTP smoke against a running LaGecto instance.
 * Does not create users or write shop data.
 *
 *   SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 */
const BASE = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: options.redirect || "manual",
    method: options.method || "GET",
    headers: options.headers,
    body: options.body,
  });
  return response;
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`ok   ${message}`);
}

async function expectStatus(path, allowed, options) {
  try {
    const response = await request(path, options);
    if (!allowed.includes(response.status)) {
      fail(`${path} expected ${allowed.join("|")} got ${response.status}`);
      return response;
    }
    ok(`${path} ${response.status}`);
    return response;
  } catch (error) {
    fail(`${path} ${error instanceof Error ? error.message : "network error"}`);
    return null;
  }
}

async function main() {
  console.log(`smoke ${BASE}`);

  await expectStatus("/", [200]);
  await expectStatus("/marketplace", [200]);
  await expectStatus("/marketplace?q=test", [200]);
  await expectStatus("/shops", [200]);
  await expectStatus("/how-it-works", [200]);
  await expectStatus("/plans", [200]);
  await expectStatus("/news", [200]);
  await expectStatus("/contact", [200]);
  await expectStatus("/register-shop", [200]);
  await expectStatus("/cart", [200]);
  await expectStatus("/login", [200]);
  await expectStatus("/signup", [200]);
  await expectStatus("/support/terms", [200]);
  await expectStatus("/support/privacy", [200]);
  await expectStatus("/support/rules", [200]);
  await expectStatus("/api/health", [200, 503]);

  const shop = await expectStatus("/shop", [307, 308, 302]);
  if (shop) {
    const location = shop.headers.get("location") || "";
    if (!location.includes("/login")) fail("/shop should redirect to login");
    else ok("/shop redirects to login");
    if ((shop.headers.get("x-robots-tag") || "").includes("noindex")) ok("/shop noindex");
    else fail("/shop missing X-Robots-Tag");
  }

  await expectStatus("/customer", [307, 308, 302]);
  await expectStatus("/admin", [307, 308, 302]);

  const adminApi = await expectStatus("/api/admin/users", [401, 403, 405], { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (adminApi && [401, 403].includes(adminApi.status)) ok("admin API rejects anonymous POST");

  await expectStatus("/api/cart", [401, 403], { method: "PUT", headers: { "content-type": "application/json" }, body: "{\"items\":[]}" });
  await expectStatus("/api/shop/pos", [401, 403], { method: "POST", headers: { "content-type": "application/json" }, body: "{\"items\":[]}" });
  await expectStatus("/api/shop/sales", [401, 403], { method: "POST", headers: { "content-type": "application/json" }, body: "{\"items\":[]}" });
  await expectStatus("/api/orders/checkout", [400, 401, 403], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{\"shopId\":\"x\",\"items\":[]}",
  });

  const robots = await expectStatus("/robots.txt", [200]);
  if (robots) {
    const body = await robots.text();
    if (!body.includes("Disallow: /admin")) fail("robots.txt missing /admin disallow");
    else ok("robots.txt disallows /admin");
    if (!body.includes("sitemap")) fail("robots.txt missing sitemap");
    else ok("robots.txt has sitemap");
  }

  const sitemap = await expectStatus("/sitemap.xml", [200]);
  if (sitemap) {
    const body = await sitemap.text();
    if (body.includes("/admin") || body.includes("/customer/")) fail("sitemap leaked a private path");
    else ok("sitemap has no private dashboards");
    if (!body.includes("/marketplace")) fail("sitemap missing marketplace");
    else ok("sitemap includes marketplace");
  }

  const home = await expectStatus("/", [200]);
  if (home) {
    const csp = home.headers.get("content-security-policy") || "";
    const frame = home.headers.get("x-frame-options") || "";
    if (!csp.includes("default-src")) fail("missing CSP");
    else ok("CSP present");
    if (frame.toUpperCase() !== "DENY") fail("X-Frame-Options should be DENY");
    else ok("X-Frame-Options DENY");
  }

  if (process.exitCode) {
    console.error("smoke failed");
    process.exit(process.exitCode);
  }
  console.log("smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
