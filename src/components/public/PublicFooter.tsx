import Link from "next/link";
import { Headphones, Store, ShoppingBag, ShoppingCart, UserRound } from "lucide-react";
import { CONTACT, BRAND } from "@/lib/brand";

export function PublicFooter() {
  return (
    <footer className="no-print px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-2 lg:pb-4">
      <div
        className="fixed inset-x-3 z-30 mx-auto flex max-w-3xl items-center justify-between gap-1 rounded-[28px] border border-[var(--lagecto-border)] bg-[color-mix(in_srgb,var(--lagecto-ivory)_92%,transparent)] px-2 py-1.5 shadow-[0_16px_40px_rgba(18,36,28,0.12)] backdrop-blur-xl lg:static lg:px-3 lg:py-2"
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
      <p className="mt-3 hidden text-center text-[11px] text-[var(--lagecto-muted)] lg:block">
        {BRAND.name} · {BRAND.location} · {CONTACT.phoneDisplay}
      </p>
    </footer>
  );
}
