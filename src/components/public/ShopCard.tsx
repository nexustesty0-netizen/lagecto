import Link from "next/link";
import { shopHref } from "@/lib/storefront/paths";
import { categoryLabel } from "@/lib/brand";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { imageForCategory, type PublicShop } from "@/lib/public-catalog";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { ShopBadgePills } from "@/components/loyalty/BadgeCard";

export function ShopCover({
  name,
  bannerUrl,
  logoUrl,
  category,
  verified,
  className = "aspect-[4/3]",
}: {
  name: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  category?: string | null;
  verified?: boolean;
  className?: string;
}) {
  const cover = bannerUrl || imageForCategory(category || "other");
  return (
    <div className={`relative overflow-hidden bg-[#eee8d8] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="absolute left-2 top-2 h-7 w-7 rounded-lg object-cover shadow-md ring-1 ring-white sm:left-3 sm:top-3 sm:h-10 sm:w-10 sm:rounded-xl sm:ring-2"
        />
      ) : (
        <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-xs font-semibold text-[#0B6E4F] shadow-md sm:left-3 sm:top-3 sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {verified ? <VerifiedBadge verified className="absolute right-2 top-2 z-[1] sm:right-2 sm:top-2" /> : null}
    </div>
  );
}

export const SHOP_GRID_CLASS = "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4";

export function ShopCard({ shop }: { shop: PublicShop & { slug?: string | null } }) {
  return (
    <Link
      href={shopHref(shop)}
      className="group overflow-hidden rounded-2xl bg-[var(--lagecto-ivory)] shadow-[var(--lg-shadow)] ring-1 ring-[var(--lagecto-border)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--lg-shadow-hover)] sm:rounded-[22px]"
    >
      <ShopCover
        name={shop.name}
        bannerUrl={shop.bannerUrl}
        logoUrl={shop.logoUrl}
        category={shop.category}
        verified={shop.verificationStatus === "verified"}
        className="aspect-[4/3]"
      />
      <div className="p-2.5 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-tight sm:gap-2 sm:text-base">
              <span className="line-clamp-2">{shop.name}</span>
              <VerifiedBadge verified={shop.verificationStatus === "verified"} />
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[var(--lagecto-muted)] sm:gap-1.5 sm:text-sm">
              <CategoryIcon slug={shop.category} className="h-3.5 w-3.5 shrink-0 text-[#0B6E4F]" />
              <span className="truncate">{categoryLabel(shop.category)}</span>
            </p>
          </div>
          <span className={`badge shrink-0 ${shop.isOpen ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
            {shop.isOpen ? "Open" : "Closed"}
          </span>
        </div>
        <p className="mt-2 hidden line-clamp-1 text-sm text-[var(--lagecto-muted)] sm:block">{shop.address || "Address not listed"}</p>
        <p className="mt-1 text-xs sm:text-sm">
          {shop.avgRating.toFixed(1)} · {shop.totalReviews} reviews
        </p>
        <div className="hidden sm:block">
          <ShopBadgePills badges={shop.badges} />
        </div>
      </div>
    </Link>
  );
}
