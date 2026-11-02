import type { CSSProperties } from "react";
import type { StorefrontConfig, StorefrontShop } from "@/lib/storefront/load";
import type { ResolvedStorefrontTheme } from "@/lib/storefront/theme";

export type StorefrontLayoutTemplate = "classic" | "tech";
export type TechHeroPage = "home" | "about" | "services" | "promotions" | "contact" | "blog" | "projects";

export const DEFAULT_HEROES: Record<TechHeroPage, string> = {
  home: "/visuals/public-hero.png",
  about: "/visuals/login-hero.png",
  services: "/marketplace/support-hero.png",
  promotions: "/visuals/plans-hero.jpg",
  contact: "/marketplace/shops-hero.png",
  blog: "/assets/auth/hero-desktop.jpg",
  projects: "/assets/auth/hero-tablet.jpg",
};

const DEFAULT_POSITIONS: Record<TechHeroPage, string> = {
  home: "center",
  about: "center 28%",
  services: "center 42%",
  promotions: "center 62%",
  contact: "center 34%",
  blog: "center 40%",
  projects: "center 36%",
};

export type TechCopy = {
  kicker: string;
  headline: string;
  aboutHero: string;
  servicesHero: string;
  promotionsHero: string;
  contactHero: string;
  whatsappMessage: string;
};

const SHOP_COPY: Record<string, TechCopy> = {
  "gecto-tech": {
    kicker: "Gecto Tech",
    headline: "Smart Tech. Better Living.",
    aboutHero: "About Gecto Tech",
    servicesHero: "Technology Solutions That Move You Forward",
    promotionsHero: "Exclusive Offers and Promotions",
    contactHero: "Let's Talk Technology",
    whatsappMessage: "Hello Gecto Tech, I visited your LaGecto storefront and would like to make an enquiry.",
  },
};

export function isTechStorefront(_shop?: Pick<StorefrontShop, "slug">, _config?: StorefrontConfig | null) {
  return true;
}

export function techCopyFor(shop: Pick<StorefrontShop, "name" | "slug">): TechCopy {
  return (
    SHOP_COPY[shop.slug] || {
      kicker: shop.name,
      headline: shop.name,
      aboutHero: `About ${shop.name}`,
      servicesHero: "Services",
      promotionsHero: "Offers and promotions",
      contactHero: `Contact ${shop.name}`,
      whatsappMessage: `Hello ${shop.name}, I visited your LaGecto storefront and would like to make an enquiry.`,
    }
  );
}

function configHero(config: StorefrontConfig | null | undefined, page: TechHeroPage) {
  if (page === "home") return config?.hero_home_url;
  if (page === "about") return config?.hero_about_url;
  if (page === "services") return config?.hero_services_url;
  if (page === "promotions") return config?.hero_promotions_url;
  if (page === "blog" || page === "projects") return null;
  return config?.hero_contact_url;
}

export function showsStorefrontProjects(providerType?: string | null) {
  return providerType !== "products";
}

export function techHeroImage(
  page: TechHeroPage,
  shop: Pick<StorefrontShop, "banner_url">,
  config?: StorefrontConfig | null,
  fallbacks: string[] = [],
) {
  const configured = String(configHero(config, page) || "").trim();
  if (configured) return configured;
  if (page === "home") {
    if (shop.banner_url) return shop.banner_url;
    const extra = fallbacks.find((url) => String(url || "").trim());
    if (extra) return extra;
  }
  return DEFAULT_HEROES[page];
}

export function techHeroPosition(page: TechHeroPage, config?: StorefrontConfig | null) {
  if (page === "home") {
    const focus = String(config?.cover_position || "").toLowerCase();
    if (focus === "top") return "center top";
    if (focus === "bottom") return "center bottom";
  }
  return DEFAULT_POSITIONS[page];
}

export function filterCatalog<T extends { name: string; description?: string | null; category?: string | null }>(
  items: T[],
  q?: string | null,
) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => `${item.name} ${item.description || ""} ${item.category || ""}`.toLowerCase().includes(needle));
}

export function techPageTitle(shop: Pick<StorefrontShop, "name" | "meta_title" | "slug">, page: TechHeroPage | "products") {
  const copy = techCopyFor(shop);
  const heading =
    page === "about"
      ? copy.aboutHero
      : page === "services"
        ? copy.servicesHero
        : page === "promotions"
          ? copy.promotionsHero
          : page === "contact"
            ? copy.contactHero
            : page === "products"
              ? "Products"
              : page === "blog"
                ? "Blog / Vlog"
                : page === "projects"
                  ? "Projects"
                  : copy.headline;
  return `${heading} · ${shop.meta_title || shop.name}`;
}

export function techNavLinks(slug: string, opts: { products?: boolean; services?: boolean } = {}) {
  const base = `/s/${encodeURIComponent(String(slug || "").trim())}`;
  return [
    { href: base, label: "Home" },
    { href: `${base}/about`, label: "About" },
    ...(opts.services ? [{ href: `${base}/services`, label: "Services" }] : []),
    ...(opts.products ? [{ href: `${base}/products`, label: "Products" }] : []),
    ...(opts.services ? [{ href: `${base}/projects`, label: "Projects" }] : []),
    { href: `${base}/promotions`, label: "Promotions" },
    { href: `${base}/blog`, label: "Blog / Vlog" },
    { href: `${base}/contact`, label: "Contact" },
  ];
}

export function techHomeActions(slug: string, opts: { services?: boolean; products?: boolean } = {}) {
  const base = `/s/${encodeURIComponent(String(slug || "").trim())}`;
  const catalog = opts.services
    ? { href: `${base}/services`, label: "Our services", primary: true }
    : opts.products
      ? { href: `${base}/products`, label: "Our products", primary: true }
      : null;
  const about = { href: `${base}/about`, label: "About us", primary: false };
  const contact = { href: `${base}/contact`, label: "Contact us", primary: false };
  return catalog ? [catalog, about, contact] : [about, contact];
}

export function applyTechTheme(
  shop: Pick<StorefrontShop, "slug">,
  config: StorefrontConfig | null | undefined,
  theme: ResolvedStorefrontTheme,
): ResolvedStorefrontTheme {
  const gecto = shop.slug === "gecto-tech";
  const unset = !config?.primary_color || config.primary_color.toUpperCase() === "#0B6E4F";
  const primary = gecto && unset ? "#057C5D" : theme.primary;
  return {
    ...theme,
    primary,
    buttonBg: primary,
    navBg: "#FFFFFF",
    navText: "#12241C",
    cssVars: {
      ...theme.cssVars,
      ["--sf-primary" as string]: primary,
      ["--sf-button" as string]: primary,
      ["--sf-nav" as string]: "#FFFFFF",
      ["--sf-nav-text" as string]: "#12241C",
    } as CSSProperties,
  };
}

export function serviceIconHint(name: string, icon?: string | null) {
  if (icon) return icon;
  const n = String(name || "").toLowerCase();
  if (/web|site|wordpress|software/.test(n)) return "software";
  if (/graphic|brand|logo|design/.test(n)) return "graphic_design";
  if (/print/.test(n)) return "printing";
  if (/support|repair|network|it\b/.test(n)) return "computers";
  if (/market|seo|social/.test(n)) return "marketing";
  if (/photo/.test(n)) return "photography";
  if (/video/.test(n)) return "videography";
  if (/phone|mobile/.test(n)) return "phones";
  return "electronics";
}
