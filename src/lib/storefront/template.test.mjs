import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  applyTechTheme,
  DEFAULT_HEROES,
  filterCatalog,
  isTechStorefront,
  techCopyFor,
  techHeroImage,
  techHomeActions,
  techNavLinks,
  techPageTitle,
  showsStorefrontProjects,
} from "./template.ts";
import { parseStorefrontEnquiry } from "./enquiry.ts";
import { normalizeShopAddress } from "./map.ts";

const shop = { name: "Gecto Tech", slug: "gecto-tech", banner_url: "/shop-banner.jpg" };
const other = { name: "Thabi Fashion", slug: "thabi-fashion", banner_url: "/other-banner.jpg" };

test("every shop uses the premium storefront layout", () => {
  assert.equal(isTechStorefront(shop, null), true);
  assert.equal(isTechStorefront(other, null), true);
  assert.equal(isTechStorefront(other, { layout_template: "classic" }), true);
});

test("home hero has three buttons: catalogue, about, and contact", () => {
  const actions = techHomeActions("gecto-tech", { services: true, products: true });
  assert.deepEqual(
    actions.map((item) => item.label),
    ["Our services", "About us", "Contact us"],
  );
  const productsOnly = techHomeActions("thabi-fashion", { services: false, products: true });
  assert.deepEqual(
    productsOnly.map((item) => item.label),
    ["Our products", "About us", "Contact us"],
  );
});

test("gecto-tech copy stays shop-specific and is not reused for other shops", () => {
  const copy = techCopyFor(shop);
  assert.equal(copy.headline, "Smart Tech. Better Living.");
  assert.match(copy.whatsappMessage, /Hello Gecto Tech/);
  const otherCopy = techCopyFor(other);
  assert.equal(otherCopy.headline, "Thabi Fashion");
  assert.doesNotMatch(otherCopy.whatsappMessage, /Gecto Tech/);
});

test("each tech page has a unique default hero and does not reuse the banner on inner pages", () => {
  const images = ["home", "about", "services", "promotions", "contact", "blog", "projects"].map((page) =>
    techHeroImage(page, shop, null),
  );
  assert.equal(new Set(Object.values(DEFAULT_HEROES)).size, 7);
  assert.equal(new Set(images).size, 7);
  assert.equal(techHeroImage("home", shop, null), "/shop-banner.jpg");
  assert.equal(techHeroImage("about", shop, null), DEFAULT_HEROES.about);
  assert.equal(
    techHeroImage("contact", shop, { hero_contact_url: "https://cdn.example/contact.jpg" }),
    "https://cdn.example/contact.jpg",
  );
  assert.equal(techHeroImage("about", other, null), DEFAULT_HEROES.about);
  assert.equal(techHeroImage("blog", shop, null), DEFAULT_HEROES.blog);
  assert.equal(techHeroImage("projects", shop, null), DEFAULT_HEROES.projects);
  assert.equal(techPageTitle(shop, "blog"), "Blog / Vlog · Gecto Tech");
  assert.equal(techPageTitle(shop, "projects"), "Projects · Gecto Tech");
});

test("product search filters by name and description", () => {
  const items = [
    { name: "Laptop stand", description: "Desk accessory", category: "electronics" },
    { name: "Website build", description: "Custom site", category: "software" },
  ];
  assert.equal(filterCatalog(items, "laptop").length, 1);
  assert.equal(filterCatalog(items, "site").length, 1);
  assert.equal(filterCatalog(items, "").length, 2);
});

test("tech navigation keeps cart, account, and marketplace without a search button", () => {
  const links = techNavLinks("gecto-tech", { products: true, services: true }).map((link) => link.label);
  assert.deepEqual(links, [
    "Home",
    "About",
    "Services",
    "Products",
    "Projects",
    "Promotions",
    "Blog / Vlog",
    "Contact",
  ]);
  const productsOnly = techNavLinks("thabi-fashion", { products: true, services: false }).map((link) => link.label);
  assert.deepEqual(productsOnly, ["Home", "About", "Products", "Promotions", "Blog / Vlog", "Contact"]);
  assert.equal(showsStorefrontProjects("services"), true);
  assert.equal(showsStorefrontProjects("both"), true);
  assert.equal(showsStorefrontProjects("products"), false);
  const chrome = readFileSync(new URL("../../components/storefront/tech/TechChrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /href="\/cart"/);
  assert.match(chrome, /href="\/customer"/);
  assert.match(chrome, /href="\/marketplace"/);
  assert.match(chrome, />\s*Marketplace\s*</);
  assert.doesNotMatch(chrome, /Search products/);
  const blog = readFileSync(new URL("../../app/s/[slug]/blog/page.tsx", import.meta.url), "utf8");
  assert.match(blog, /Blog \/ Vlog/);
  assert.match(blog, /storefront_videos/);
  assert.match(blog, /mediaFrameClass/);
  const vlog = readFileSync(new URL("../../components/storefront/StorefrontVideo.tsx", import.meta.url), "utf8");
  assert.match(vlog, /mediaFrameClass/);
  assert.match(vlog, /\bplaying\b/);
  const projects = readFileSync(new URL("../../app/s/[slug]/projects/page.tsx", import.meta.url), "utf8");
  assert.match(projects, /title="Projects"/);
  assert.match(projects, /storefront_projects|getStorefrontProjects/);
  assert.doesNotMatch(projects, /Portfolio/);
});

test("every storefront uses the premium navbar and a floating WhatsApp button", () => {
  const layout = readFileSync(new URL("../../app/s/[slug]/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /TechNav/);
  assert.match(layout, /TechWhatsAppButton/);
  assert.match(layout, /sf-tech/);
  assert.doesNotMatch(layout, /StorefrontNav/);
  assert.doesNotMatch(layout, /StorefrontDock/);
});

test("shop maps correct common Zimbabwe address typos", () => {
  assert.equal(normalizeShopAddress("Lobengula, Bulawyo"), "Lobengula, Bulawayo");
});

test("shop footer is compact, shop-coloured, and powered by LaGecto", () => {
  const footer = readFileSync(new URL("../../components/storefront/StorefrontFooter.tsx", import.meta.url), "utf8");
  assert.match(footer, /Blog \/ Vlog/);
  assert.match(footer, /label: "Projects"/);
  assert.doesNotMatch(footer, /Portfolio/);
  assert.match(footer, /Powered by/);
  assert.doesNotMatch(footer, /A LaGecto shop/i);
  assert.match(footer, /privacy_policy/);
  assert.match(footer, /terms_of_service/);
  assert.match(footer, /outline/);
});

test("contact enquiry validation rejects incomplete messages", () => {
  assert.equal(parseStorefrontEnquiry({}).ok, false);
  assert.equal(parseStorefrontEnquiry({ name: "A", email: "a@b.c", phone: "0712345678", subject: "Hi", message: "Hello there" }).ok, false);
  const ok = parseStorefrontEnquiry({
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "0712345678",
    subject: "Website",
    message: "I would like a quote for a shop website.",
  });
  assert.equal(ok.ok, true);
});

test("page heroes are URL fields, not gallery uploads", () => {
  const builder = readFileSync(new URL("../../components/shop/StorefrontBuilder.tsx", import.meta.url), "utf8");
  assert.match(builder, /HeroUrlField/);
  assert.match(builder, /validateHeroUrl/);
  assert.match(builder, /Facebook, Instagram, YouTube, or TikTok video URL/);
  assert.doesNotMatch(builder, /MediaField label="Home hero"/);
  assert.doesNotMatch(builder, /MediaField label="About hero"/);
  const hero = readFileSync(new URL("../../components/storefront/tech/TechHero.tsx", import.meta.url), "utf8");
  assert.match(hero, /HeroBackdrop/);
  const backdrop = readFileSync(new URL("../../components/storefront/HeroBackdrop.tsx", import.meta.url), "utf8");
  assert.match(backdrop, /\bplaying\b/);
  assert.match(backdrop, /\bmuted\b/);
});

test("login photo is full-bleed with a blend", () => {
  const auth = readFileSync(new URL("../../components/auth/AuthLayout.tsx", import.meta.url), "utf8");
  assert.match(auth, /bg-gradient-to-t from-\[#0B6E4F\]/);
  assert.doesNotMatch(auth, /relative min-h-\[18rem\] flex-1/);
});

test("tech theme only changes the resolved storefront tokens", () => {
  const theme = applyTechTheme(shop, null, {
    primary: "#0B6E4F",
    background: "#FFFDF8",
    text: "#12241C",
    muted: "#5A6A62",
    navBg: "#FFFDF8",
    navText: "#12241C",
    card: "#FFFFFF",
    buttonBg: "#0B6E4F",
    buttonText: "#FFFFFF",
    cssVars: { ["--sf-primary"]: "#0B6E4F" },
  });
  assert.equal(theme.primary, "#057C5D");
  assert.equal(theme.navBg, "#FFFFFF");
  assert.equal(theme.cssVars["--sf-nav"], "#FFFFFF");
  assert.equal(theme.cssVars["--sf-primary"], "#057C5D");
  assert.equal(theme.cssVars["--sf-deep"], undefined);
  const fashion = applyTechTheme(other, { primary_color: "#C45C26" }, {
    primary: "#C45C26",
    background: "#FFFDF8",
    text: "#12241C",
    muted: "#5A6A62",
    navBg: "#FFFDF8",
    navText: "#12241C",
    card: "#FFFFFF",
    buttonBg: "#C45C26",
    buttonText: "#FFFFFF",
    cssVars: { ["--sf-primary"]: "#C45C26" },
  });
  assert.equal(fashion.primary, "#C45C26");
  assert.equal(fashion.cssVars["--sf-primary"], "#C45C26");
  assert.equal(fashion.navBg, "#FFFFFF");
});
