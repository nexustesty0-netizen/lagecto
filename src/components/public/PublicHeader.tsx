"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Headphones, Menu, ShoppingBag, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";
import { useCart } from "@/components/cart/useCart";

const LINKS = [
  { href: "/", label: "Marketplace", match: (path: string) => path === "/" || path.startsWith("/marketplace") },
  { href: "/shops", label: "Shops", match: (path: string) => path.startsWith("/shops") },
  { href: "/news", label: "News", match: (path: string) => path.startsWith("/news") },
  { href: "/plans", label: "Plans", match: (path: string) => path.startsWith("/plans") },
  { href: "/support", label: "Support", match: (path: string) => path.startsWith("/support") || path.startsWith("/help") },
];

export function PublicHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--lagecto-ivory)_86%,transparent)] text-[var(--lagecto-text)] backdrop-blur-xl transition-all duration-200 ${
        scrolled ? "border-[var(--lagecto-border)] shadow-[0_10px_30px_rgba(18,36,28,0.08)]" : "border-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-4 transition-all duration-200 ${
          scrolled ? "py-2" : "py-3"
        }`}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo size={scrolled ? 40 : 44} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-base font-semibold tracking-tight sm:text-lg">{BRAND.name}</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--lagecto-muted)] sm:block">
              Digital commerce
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary">
          {LINKS.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  active ? "text-[#0B6E4F]" : "text-[#374151] hover:text-[#0B6E4F]"
                }`}
              >
                {link.label === "Support" ? <Headphones className="h-4 w-4" aria-hidden /> : null}
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/cart" className="relative grid h-11 w-11 place-items-center rounded-full border border-[var(--lagecto-border)] bg-white" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {count ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#0B6E4F] px-1 text-[10px] font-semibold text-white">
                {count}
              </span>
            ) : null}
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--lagecto-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--lagecto-text)]"
          >
            Sign in
          </Link>
          <Link href="/register-shop" className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(11,110,79,0.22)]">
            Register a shop
          </Link>
        </div>
        <div className="flex items-center gap-1 lg:hidden">
          <Link href="/cart" className="relative grid h-11 w-11 place-items-center rounded-full border border-[var(--lagecto-border)] bg-white lg:hidden" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {count ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#0B6E4F] px-1 text-[10px] font-semibold text-white">
                {count}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="grid gap-1 border-t border-[var(--lagecto-border)] bg-[var(--lagecto-ivory)] px-4 py-3 lg:hidden" aria-label="Mobile">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-medium ${
                link.match(pathname) ? "bg-[#0B6E4F]/10 text-[#0B6E4F]" : "hover:bg-black/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/cart" className="min-h-11 rounded-xl px-3 py-2.5 text-sm hover:bg-black/5">
            Cart{count ? ` (${count})` : ""}
          </Link>
          <Link href="/login" className="min-h-11 rounded-xl px-3 py-2.5 text-sm hover:bg-black/5">
            Sign in
          </Link>
          <Link href="/register-shop" className="min-h-11 rounded-xl bg-[#0B6E4F] px-3 py-2.5 text-sm font-semibold text-white">
            Register a shop
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
