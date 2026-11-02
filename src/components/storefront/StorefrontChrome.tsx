"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, Newspaper, Phone, ShoppingBag, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { storefrontNavLinks, storefrontPath } from "@/lib/storefront/paths";
import { useCart } from "@/components/cart/useCart";
import type { StorefrontShop } from "@/lib/storefront/load";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { categoryLabel } from "@/lib/brand";

export function StorefrontMarketplaceButton({ className = "" }: { className?: string }) {
  return (
    <Link href="/marketplace" className={`sf-btn ${className}`.trim()}>
      Marketplace
    </Link>
  );
}

function coverObjectPosition(value?: string | null) {
  if (value === "top") return "center top";
  if (value === "bottom") return "center bottom";
  return "center";
}

export function StorefrontHeroBackdrop({
  bannerUrl,
  coverPosition,
  category,
}: {
  bannerUrl?: string | null;
  coverPosition?: string | null;
  category?: string | null;
}) {
  if (bannerUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={bannerUrl}
        alt=""
        className="sf-hero-zoom absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: coverObjectPosition(coverPosition) }}
      />
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "var(--sf-primary, #0B6E4F)" }}>
      <span className="grid h-28 w-28 place-items-center rounded-[2rem] bg-white/12 text-white sm:h-36 sm:w-36">
        <CategoryIcon slug={category} className="h-16 w-16 sm:h-20 sm:w-20" />
      </span>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">{categoryLabel(category)}</p>
    </div>
  );
}

export function StorefrontLogo({
  shop,
  size = 40,
  className = "",
}: {
  shop: Pick<StorefrontShop, "name" | "logo_url">;
  size?: number;
  className?: string;
}) {
  if (shop.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={shop.logo_url}
        alt={shop.name}
        width={size}
        height={size}
        className={`rounded-2xl object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`grid place-items-center rounded-2xl text-sm font-semibold ${className}`}
      style={{ width: size, height: size, background: "var(--sf-primary)", color: "var(--sf-on-primary)" }}
    >
      {shop.name.slice(0, 1)}
    </span>
  );
}

export function StorefrontNav({
  shop,
  showProducts,
  showServices,
}: {
  shop: StorefrontShop;
  showProducts: boolean;
  showServices: boolean;
}) {
  const pathname = usePathname();
  const { count } = useCart();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const open = menuFor === pathname;
  const base = storefrontPath(shop.slug);
  const links = storefrontNavLinks(shop.slug, { products: showProducts, services: showServices });
  const shopHref = showProducts ? `${base}/products` : showServices ? `${base}/services` : `${base}/contact`;

  return (
    <header className="sticky top-0 z-40 no-print" style={{ color: "var(--sf-nav-text)", paddingTop: "env(safe-area-inset-top)" }}>
      <div
        className="border-b"
        style={{
          background: "#FFFFFF",
          borderColor: "color-mix(in srgb, var(--sf-primary) 16%, transparent)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 lg:h-[4.25rem]">
          <Link href={base} className="flex min-w-0 items-center gap-3">
            <StorefrontLogo shop={shop} size={36} className="shadow-sm ring-1 ring-black/5" />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold tracking-tight sm:text-base">{shop.name}</span>
                {shop.verified ? <VerifiedBadge verified /> : null}
              </span>
              <span className="hidden text-[10px] uppercase tracking-[0.16em] opacity-60 sm:block">
                {shop.is_open ? "Open now" : "Closed"}
              </span>
            </span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label={`${shop.name} storefront`}>
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-[13px] font-medium transition"
                  style={
                    active
                      ? { background: "color-mix(in srgb, var(--sf-primary) 14%, transparent)", color: "var(--sf-primary)" }
                      : { opacity: 0.72 }
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <StorefrontMarketplaceButton className="h-10 px-3 text-xs" />
            <Link href={shopHref} className="sf-btn hidden h-10 px-4 text-xs sm:inline-flex">
              {showProducts ? "Shop" : showServices ? "Services" : "Visit"}
            </Link>
            <ShareStorefrontButton slug={shop.slug} shopName={shop.name} compact />
            <Link href="/cart" className="sf-icon-btn relative" aria-label="Cart">
              <ShoppingBag size={17} />
              {count ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold" style={{ background: "var(--sf-button)", color: "var(--sf-button-text)" }}>
                  {count}
                </span>
              ) : null}
            </Link>
            <button type="button" className="sf-icon-btn lg:hidden" aria-label="Open shop menu" onClick={() => setMenuFor(pathname)}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden" onClick={() => setMenuFor(null)}>
          <nav
            className="ml-auto h-full w-[min(22rem,88%)] p-6 shadow-2xl"
            style={{ background: "var(--sf-nav)", color: "var(--sf-nav-text)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-8 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <StorefrontLogo shop={shop} size={36} />
                <span className="truncate font-semibold">{shop.name}</span>
              </span>
              <button type="button" className="sf-icon-btn" onClick={() => setMenuFor(null)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl px-3 py-3 text-lg"
                  style={pathname === link.href ? { background: "color-mix(in srgb, var(--sf-primary) 12%, transparent)" } : undefined}
                  onClick={() => setMenuFor(null)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <StorefrontMarketplaceButton className="mt-8 w-full" />
            <Link href={`${base}/contact`} className="sf-btn-ghost mt-3 w-full">
              Contact the shop
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function StorefrontDock({
  shop,
  showProducts,
  showServices,
}: {
  shop: StorefrontShop;
  showProducts: boolean;
  showServices: boolean;
}) {
  const pathname = usePathname();
  const base = storefrontPath(shop.slug);
  const items = [
    { href: base, label: "Home", Icon: Home },
    ...(showProducts
      ? [{ href: `${base}/products`, label: "Shop", Icon: ShoppingBag }]
      : showServices
        ? [{ href: `${base}/services`, label: "Services", Icon: ShoppingBag }]
        : []),
    { href: `${base}/blog`, label: "Blog / Vlog", Icon: Newspaper },
    { href: `${base}/contact`, label: "Contact", Icon: Phone },
    { href: "/cart", label: "Cart", Icon: ShoppingCart },
  ];
  return (
    <nav
      className="fixed inset-x-3 z-30 mx-auto grid max-w-lg grid-cols-5 rounded-[var(--lg-radius)] border px-1 py-1.5 no-print lg:hidden"
      style={{
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        background: "var(--sf-nav)",
        borderColor: "color-mix(in srgb, var(--sf-text) 12%, transparent)",
        color: "var(--sf-nav-text)",
      }}
      aria-label="Shop navigation"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={`grid min-h-11 place-items-center gap-0.5 py-1 text-[10px] ${active ? "font-semibold" : "opacity-70"}`}>
            <item.Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
