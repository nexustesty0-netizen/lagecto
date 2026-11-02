import Link from "next/link";
import { Headphones, Store, ShoppingBag, ShoppingCart, UserRound } from "lucide-react";
import { CONTACT, BRAND } from "@/lib/brand";

export function PublicFooter() {
  return (
    <footer className="no-print px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-2 lg:pb-4">
      <div
        className="fixed inset-x-3 z-30 mx-auto flex max-w-3xl items-center justify-between gap-1 rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-[var(--lagecto-ivory)] px-2 py-1.5 lg:static lg:px-3 lg:py-2"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <Link href="/" className="grid min-h-11 flex-1 place-items-center gap-1 rounded-2xl text-[11px] font-medium text-[var(--lagecto-muted)]">
          <ShoppingBag className="h-4 w-4 text-[#0B6E4F]" />
          Shop
        </Link>
        <Link href="/shops" className="grid min-h-11 flex-1 place-items-center gap-1 rounded-2xl text-[11px] font-medium text-[var(--lagecto-muted)]">
          <Store className="h-4 w-4 text-[#0B6E4F]" />
          Shops
        </Link>
        <Link href="/cart" className="grid min-h-11 flex-1 place-items-center gap-1 rounded-2xl text-[11px] font-medium text-[var(--lagecto-muted)]">
          <ShoppingCart className="h-4 w-4 text-[#0B6E4F]" />
          Cart
        </Link>
        <Link href="/support" className="grid min-h-11 flex-1 place-items-center gap-1 rounded-2xl text-[11px] font-medium text-[var(--lagecto-muted)]">
          <Headphones className="h-4 w-4 text-[#0B6E4F]" />
          Support
        </Link>
        <Link href="/login" className="grid min-h-11 flex-1 place-items-center gap-1 rounded-2xl text-[11px] font-medium text-[var(--lagecto-muted)]">
          <UserRound className="h-4 w-4 text-[#0B6E4F]" />
          Sign in
        </Link>
      </div>
      <div className="mt-3 hidden flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[11px] text-[var(--lagecto-muted)] lg:flex">
        <span>
          {BRAND.name} · {BRAND.location} · {CONTACT.phoneDisplay}
        </span>
        <Link href="/support/terms" className="underline-offset-2 hover:underline">
          Terms
        </Link>
        <Link href="/support/privacy" className="underline-offset-2 hover:underline">
          Privacy
        </Link>
        <Link href="/support/rules" className="underline-offset-2 hover:underline">
          Marketplace rules
        </Link>
        <Link href="/contact" className="underline-offset-2 hover:underline">
          Contact
        </Link>
        <span>Session cookies keep you signed in. See Privacy.</span>
      </div>
    </footer>
  );
}
