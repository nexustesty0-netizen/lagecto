"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { storefrontPath } from "@/lib/storefront/paths";
import { useCart } from "@/components/cart/useCart";
import type { StorefrontShop } from "@/lib/storefront/load";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";

function coverObjectPosition(value?: string | null) {
  if (value === "top") return "center top";
  if (value === "bottom") return "center bottom";
  return "center";
}

export function StorefrontHeroBackdrop({
  bannerUrl,
  coverPosition,
}: {
  bannerUrl?: string | null;
  coverPosition?: string | null;
}) {
  return (
    <>
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: coverObjectPosition(coverPosition) }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--sf-primary) 78%, #04180f) 0%, var(--sf-primary) 48%, color-mix(in srgb, var(--sf-secondary) 42%, var(--sf-primary)) 100%)",
          }}
        />
      )}
      <div className={bannerUrl ? "absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/15" : "absolute inset-0 bg-gradient-to-r from-black/25 to-transparent"} />
    </>
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
  const links = [
    { href: base, label: "Home" },
    ...(showProducts ? [{ href: `${base}/products`, label: "Products" }] : []),
    ...(showServices ? [{ href: `${base}/services`, label: "Services" }] : []),
    { href: `${base}/promotions`, label: "Promotions" },
    { href: `${base}/blog`, label: "Blog" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/contact`, label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b no-print" style={{ background: "var(--sf-nav)", color: "var(--sf-nav-text)", borderColor: "color-mix(in srgb, var(--sf-text) 12%, transparent)", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href={base} className="flex min-w-0 items-center gap-3">
          <StorefrontLogo shop={shop} size={40} />
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{shop.name}</span>
            {shop.verified ? <VerifiedBadge verified /> : null}
          </span>
        </Link>
        <nav className="hidden items-center gap-5 lg:flex" aria-label={`${shop.name} storefront`}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`text-sm font-medium ${pathname === link.href ? "underline underline-offset-4" : "opacity-80 hover:opacity-100"}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ShareStorefrontButton slug={shop.slug} shopName={shop.name} compact />
          <Link href="/cart" className="relative grid h-11 w-11 place-items-center rounded-full border" aria-label="Cart">
            <ShoppingBag size={18} />
            {count ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold" style={{ background: "var(--sf-button)", color: "var(--sf-button-text)" }}>
                {count}
              </span>
            ) : null}
          </Link>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-lg lg:hidden" aria-label="Open shop menu" onClick={() => setMenuFor(pathname)}>
            <Menu size={20} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMenuFor(null)}>
          <nav className="h-full w-[82%] max-w-sm p-4" style={{ background: "var(--sf-nav)", color: "var(--sf-nav-text)" }} onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold">{shop.name}</span>
                {shop.verified ? <VerifiedBadge verified /> : null}
              </span>
              <button type="button" onClick={() => setMenuFor(null)} aria-label="Close menu">
                <X />
              </button>
            </div>
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="block rounded-xl px-3 py-3">
                {link.label}
              </Link>
            ))}
            <Link href={`/support/report-shop?shop=${shop.id}`} className="mt-6 block px-3 py-2 text-xs opacity-70">
              Report shop
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
    { href: base, label: "Home" },
    ...(showProducts ? [{ href: `${base}/products`, label: "Shop" }] : showServices ? [{ href: `${base}/services`, label: "Services" }] : []),
    { href: `${base}/blog`, label: "Blog" },
    { href: `${base}/contact`, label: "Contact" },
    { href: "/cart", label: "Cart" },
  ];
  return (
    <nav className="fixed inset-x-3 z-30 mx-auto grid max-w-lg grid-cols-5 rounded-[28px] border px-1 py-2 shadow-lg backdrop-blur-xl no-print lg:hidden" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))", background: "color-mix(in srgb, var(--sf-nav) 92%, transparent)", borderColor: "color-mix(in srgb, var(--sf-text) 12%, transparent)", color: "var(--sf-nav-text)" }} aria-label="Shop navigation">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={`grid min-h-11 place-items-center py-1 text-[11px] ${pathname === item.href ? "font-semibold" : "opacity-70"}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
