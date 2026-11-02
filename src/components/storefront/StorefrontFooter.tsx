import Link from "next/link";
import type { StorefrontShop } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { BRAND } from "@/lib/brand";
import { StorefrontLogo, StorefrontMarketplaceButton } from "@/components/storefront/StorefrontChrome";
import { StorefrontSocialLinks } from "@/components/storefront/StorefrontSocialLinks";

export function StorefrontFooter({
  shop,
  showProducts,
  showServices,
}: {
  shop: StorefrontShop;
  showProducts: boolean;
  showServices: boolean;
}) {
  const base = storefrontPath(shop.slug);
  const shopHref = showProducts ? `${base}/products` : showServices ? `${base}/services` : `${base}/contact`;
  const shopLabel = showProducts ? "Shop" : showServices ? "Services" : "Visit";
  const links = [
    { href: base, label: "Home" },
    { href: shopHref, label: shopLabel },
    ...(showServices ? [{ href: `${base}/projects`, label: "Projects" }] : []),
    { href: `${base}/blog`, label: "Blog / Vlog" },
    { href: `${base}/contact`, label: "Contact" },
    ...(String(shop.privacy_policy || "").trim() ? [{ href: `${base}/privacy`, label: "Privacy" }] : []),
    ...(String(shop.terms_of_service || "").trim() ? [{ href: `${base}/terms`, label: "Terms" }] : []),
  ];

  return (
    <footer
      className="sf-footer mt-8 no-print"
      style={{
        background: "color-mix(in srgb, var(--sf-primary) 7%, var(--sf-card, #fff))",
        color: "var(--sf-text)",
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--sf-primary) 28%, transparent)",
        outline: "1px solid color-mix(in srgb, var(--sf-primary) 28%, transparent)",
        outlineOffset: "-1px",
      }}
    >
      <div className="sf-footer-ribbon" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between">
        <Link href={base} className="flex items-center gap-3">
          <span className="sf-logo-3d inline-flex">
            <StorefrontLogo shop={shop} size={36} />
          </span>
          <span className="text-sm font-semibold">{shop.name}</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" aria-label="Footer">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="opacity-75 transition hover:opacity-100">
              {link.label}
            </Link>
          ))}
          <StorefrontMarketplaceButton className="h-10 px-4 text-xs" />
        </nav>
        <StorefrontSocialLinks shop={shop} compact className="justify-center" />
      </div>
      <p className="relative px-4 pb-4 text-center text-[11px]" style={{ color: "var(--sf-muted)" }}>
        © {new Date().getFullYear()} {shop.name} · Powered by{" "}
        <Link href="/" className="font-semibold">
          {BRAND.name}
        </Link>
      </p>
    </footer>
  );
}
