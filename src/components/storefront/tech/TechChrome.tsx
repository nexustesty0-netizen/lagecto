"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useState } from "react";
import { storefrontPath } from "@/lib/storefront/paths";
import { useCart } from "@/components/cart/useCart";
import type { StorefrontShop } from "@/lib/storefront/load";
import { techNavLinks } from "@/lib/storefront/template";
import { shopWhatsAppUrl } from "@/lib/brand";

export function TechLogo({ shop, className = "" }: { shop: Pick<StorefrontShop, "name" | "logo_url">; className?: string }) {
  if (shop.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={shop.logo_url} alt={shop.name} className={`h-10 w-auto max-w-[10.5rem] object-contain object-left ${className}`} />
    );
  }
  return <span className={`text-sm font-semibold tracking-tight ${className}`}>{shop.name}</span>;
}

export function TechNav({
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
  const [open, setOpen] = useState(false);
  const base = storefrontPath(shop.slug);
  const links = techNavLinks(shop.slug, { products: showProducts, services: showServices });

  return (
    <header
      className="sticky top-0 z-40 border-b no-print"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        background: "#FFFFFF",
        color: "var(--sf-nav-text, #12241C)",
        borderColor: "color-mix(in srgb, var(--sf-primary) 18%, transparent)",
      }}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center gap-4 px-4">
        <Link href={base} className="min-w-0 shrink-0" aria-label={shop.name}>
          <TechLogo shop={shop} />
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex" aria-label={`${shop.name} storefront`}>
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== base && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-2 text-[13px] font-medium tracking-wide ${
                  active ? "text-[var(--sf-primary)] shadow-[inset_0_-2px_0_var(--sf-primary)]" : "opacity-70 hover:opacity-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/marketplace"
            className="hidden h-10 items-center px-4 text-xs font-semibold text-white sm:inline-flex"
            style={{ background: "var(--sf-primary)" }}
          >
            Marketplace
          </Link>
          <Link href="/customer" className="grid h-10 w-10 place-items-center" aria-label="Account">
            <UserRound size={18} />
          </Link>
          <Link href="/cart" className="relative grid h-10 w-10 place-items-center" aria-label="Cart">
            <ShoppingBag size={18} />
            {count ? (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center bg-[var(--sf-primary)] px-1 text-[10px] font-semibold text-white">
                {count}
              </span>
            ) : null}
          </Link>
          <button type="button" className="grid h-10 w-10 place-items-center lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" style={{ background: "color-mix(in srgb, var(--sf-primary) 35%, transparent)" }} onClick={() => setOpen(false)}>
          <nav className="ml-auto h-full w-[min(22rem,90%)] p-6 shadow-2xl" style={{ background: "var(--sf-nav)", color: "var(--sf-nav-text)" }} onClick={(event) => event.stopPropagation()}>
            <div className="mb-8 flex items-center justify-between">
              <TechLogo shop={shop} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center">
                <X size={20} />
              </button>
            </div>
            <div className="grid">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`border-b py-3 text-base ${pathname === link.href || (link.href !== base && pathname.startsWith(`${link.href}/`)) ? "font-semibold text-[var(--sf-primary)]" : ""}`}
                  style={{ borderColor: "color-mix(in srgb, var(--sf-primary) 16%, transparent)" }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link
              href="/marketplace"
              onClick={() => setOpen(false)}
              className="mt-6 inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold text-white"
              style={{ background: "var(--sf-primary)" }}
            >
              Marketplace
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function TechWhatsAppButton({ shop, message }: { shop: StorefrontShop; message: string }) {
  const href = shopWhatsAppUrl(shop.whatsapp_number || shop.phone, message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed z-30 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-offset-4"
      style={{ right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      aria-label={`WhatsApp ${shop.name}`}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden fill="currentColor">
        <path d="M19.05 4.91A9.91 9.91 0 0 0 12.04 2C6.55 2 2.09 6.45 2.09 11.94c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.49 0 9.95-4.45 9.95-9.94 0-2.65-1.03-5.15-2.95-7zM12.05 20.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.35c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.2-8.25 8.2zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.8-.79.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74 1.49.64 1.86.7 2.53.59.41-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29z" />
      </svg>
    </a>
  );
}
