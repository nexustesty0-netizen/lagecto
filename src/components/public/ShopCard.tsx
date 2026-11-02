import Link from "next/link";
import Image from "next/image";
import { shopHref } from "@/lib/storefront/paths";
import { categoryLabel } from "@/lib/brand";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { type PublicShop } from "@/lib/public-catalog";
import { QuietCover } from "@/components/media/QuietCover";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { ShopBadgePills } from "@/components/loyalty/BadgeCard";

export function ShopCover({
  name,
  bannerUrl,
  logoUrl,
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
  return (
    <div className={`relative overflow-hidden bg-[#eee8d8] ${className}`}>
      {bannerUrl ? (
        <Image
          src={bannerUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 33vw, 25vw"
          className="object-cover"
        />
      ) : (
        <QuietCover className="absolute inset-0 h-full w-full" />
      )}
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          width={40}
          height={40}
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

export const SHOP_GRID_CLASS = "grid grid-cols-3 gap-1.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4";

export function ShopCard({ shop }: { shop: PublicShop & { slug?: string | null } }) {
  return (
    <Link
      href={shopHref(shop)}
      className="overflow-hidden rounded-[var(--lg-radius)] bg-[var(--lagecto-ivory)] ring-1 ring-[var(--lagecto-border)]"
    >
      <ShopCover
        name={shop.name}
        bannerUrl={shop.bannerUrl}
        logoUrl={shop.logoUrl}
        category={shop.category}
        verified={shop.verificationStatus === "verified"}
        className="aspect-[4/3]"
      />
      <div className="p-1.5 sm:p-4">
        <div className="flex items-start justify-between gap-1 sm:gap-3">
          <div className="min-w-0">
            <p className="inline-flex flex-wrap items-center gap-1 text-[11px] font-semibold leading-snug sm:gap-2 sm:text-base">
              <span className="line-clamp-2">{shop.name}</span>
              <VerifiedBadge verified={shop.verificationStatus === "verified"} className="hidden sm:inline-flex" />
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--lagecto-muted)] sm:gap-1.5 sm:text-sm">
              <CategoryIcon slug={shop.category} className="h-3 w-3 shrink-0 text-[#0B6E4F] sm:h-3.5 sm:w-3.5" />
              <span className="truncate">{categoryLabel(shop.category)}</span>
            </p>
          </div>
          <span className={`badge hidden shrink-0 sm:inline-flex ${shop.isOpen ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
            {shop.isOpen ? "Open" : "Closed"}
          </span>
        </div>
        <p className="mt-2 hidden line-clamp-1 text-sm text-[var(--lagecto-muted)] sm:block">{shop.address || "Address not listed"}</p>
        <p className="mt-1 text-[10px] sm:text-sm">
          {shop.avgRating.toFixed(1)} · {shop.totalReviews} reviews
        </p>
        <div className="hidden sm:block">
          <ShopBadgePills badges={shop.badges} />
        </div>
      </div>
    </Link>
  );
}
