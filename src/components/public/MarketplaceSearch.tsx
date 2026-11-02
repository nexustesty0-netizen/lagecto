import Link from "next/link";
import { Headphones, LayoutGrid, MapPin, Package, Search, ShieldCheck, Wallet } from "lucide-react";
import { MARKETPLACE_CATEGORIES } from "@/lib/public-catalog";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SearchSuggestions } from "@/components/public/SearchSuggestions";

export function MarketplaceSearch({
  action = "/marketplace",
  q,
  category,
  placeholder = "Search products, brands or shops...",
  overlap = false,
}: {
  action?: string;
  q?: string;
  category?: string;
  placeholder?: string;
  overlap?: boolean;
}) {
  const active = category || "all";
  return (
    <section className={overlap ? "-mt-6" : "pt-8"}>
      <div className="mx-auto max-w-6xl px-4">
        <form action={action} className="lg-card mx-auto max-w-3xl p-2">
          <label className="sr-only" htmlFor="marketplace-search">
            Search products
          </label>
          <div className="flex items-center rounded-full px-3">
            <Search className="h-5 w-5 shrink-0 text-[var(--lagecto-muted)]" aria-hidden />
            <SearchSuggestions q={q} placeholder={placeholder} />
            {category && category !== "all" ? <input type="hidden" name="category" value={category} /> : null}
          </div>
        </form>
        <div className="relative mt-5">
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--lagecto-cream)] to-transparent" />
          <div className="hide-scrollbar -mx-4 overflow-x-auto px-4" role="list" aria-label="Product categories">
            <div className="flex w-max snap-x snap-mandatory gap-2 pb-1">
              {MARKETPLACE_CATEGORIES.map((item) => {
                const href = item.slug === "all" ? action : `${action}?category=${item.slug}`;
                const isActive = active === item.slug;
                return (
                  <Link
                    key={item.slug}
                    href={href}
                    role="listitem"
                    className={`inline-flex min-h-9 shrink-0 snap-start items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm ${
                      isActive ? "bg-[#0B6E4F] text-white" : "border border-[var(--lagecto-border)] bg-[var(--lagecto-ivory)] text-[#1E1E1E] hover:border-[#0B6E4F]/40"
                    }`}
                  >
                    {item.slug === "all" ? <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> : <CategoryIcon slug={item.slug} className="h-3.5 w-3.5" />}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-6 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
          {[
            { href: "/shops", icon: ShieldCheck, label: "Verified shops" },
            { href: "/cart", icon: Wallet, label: "WhatsApp checkout" },
            { href: "/how-it-works", icon: Package, label: "How it works" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="inline-flex min-h-10 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--lagecto-border)] bg-[var(--lagecto-ivory)] px-2 py-2 text-center text-[11px] font-medium leading-tight sm:min-h-11 sm:flex-row sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <item.icon className="h-3.5 w-3.5 text-[#0B6E4F] sm:h-4 sm:w-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-5 border-y border-[var(--lagecto-border)] bg-[color-mix(in_srgb,white_55%,transparent)] sm:mt-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2.5 text-xs text-[var(--lagecto-muted)] sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-3 sm:text-sm">
          <p className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#0B6E4F]" aria-hidden />
            Payment and collection are arranged directly with each shop.
          </p>
          <p className="inline-flex items-center gap-2">
            Bulawayo, Zimbabwe -
            <Link href="/support" className="inline-flex items-center gap-1 font-medium text-[#0B6E4F]">
              <Headphones className="h-3.5 w-3.5" aria-hidden />
              Support
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
