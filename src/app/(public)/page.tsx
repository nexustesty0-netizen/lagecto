import Link from "next/link";
import { MarketplaceSearch } from "@/components/public/MarketplaceSearch";
import { PublicHero } from "@/components/public/PublicHero";
import { ProductGrid, CatalogEmpty, PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { ShopCard, SHOP_GRID_CLASS } from "@/components/public/ShopCard";
import { getPublicShops } from "@/lib/public-catalog";
import {
  getLatestProducts,
  getLivePromotions,
  getMostSoldProducts,
  getTopShops,
  getTrendingProducts,
  getTrendingShops,
} from "@/lib/marketplace/discovery";
import { AdStrip } from "@/components/ads/AdStrip";
import { SectionHeading } from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";
import { money } from "@/lib/format";
import { shopIsOpenNow } from "@/lib/hours";

export default async function HomePage() {
  const [trending, mostSold, latest, shops, topShops, trendingShops, promotions] = await Promise.all([
    getTrendingProducts(3),
    getMostSoldProducts(4),
    getLatestProducts(6),
    getPublicShops(),
    getTopShops(4),
    getTrendingShops(3),
    getLivePromotions(6),
  ]);

  return (
    <>
      <PublicHero
        slideshow
        kicker={BRAND.location}
        title="Shop local businesses in Bulawayo."
        subtitle={`${BRAND.tagline}. Browse shops, order on WhatsApp, and collect nearby.`}
      >
        <div className="flex gap-2 sm:flex-row sm:flex-wrap">
          <Link href="/marketplace" className="lg-btn flex-1 sm:flex-none" style={{ background: "#fff", color: "var(--lagecto-primary)" }}>
            Explore marketplace
          </Link>
          <Link href="/register-shop" className="lg-btn-ghost flex-1 sm:flex-none">
            Register a shop
          </Link>
        </div>
      </PublicHero>
      <MarketplaceSearch action="/marketplace" overlap />

      <AdStrip className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8" />

      <section className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
        <SectionHeading title="Trending products" kicker="Activity" href="/marketplace?sort=popular" linkLabel="See marketplace" />
        {trending.length ? (
          <ProductGrid products={trending.slice(0, 3)} className={PRODUCT_GRID_CLASS} />
        ) : (
          <CatalogEmpty title="Not enough activity yet" body="Trending products appear after recent views, carts and paid sales." href="/marketplace" label="Browse catalogue" />
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-7 sm:pb-10">
        <SectionHeading title="Most sold" />
        {mostSold.length ? (
          <ProductGrid products={mostSold.slice(0, 4)} className={PRODUCT_GRID_CLASS} />
        ) : (
          <CatalogEmpty title="No paid sales yet" body="Most-sold products are counted from completed paid orders and POS sales." />
        )}
      </section>

      {promotions.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-7 sm:pb-10">
          <SectionHeading title="Special offers" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {promotions.map((promo: { id: string; title: string; discount: number | null; promo_price: number | null; shops?: { name?: string; slug?: string } | { name?: string; slug?: string }[] }) => {
              const shop = Array.isArray(promo.shops) ? promo.shops[0] : promo.shops;
              return (
                <Link key={promo.id} href={shop?.slug ? `/s/${shop.slug}/promotions` : "/marketplace"} className="rounded-[var(--lg-radius)] bg-white p-3 ring-1 ring-[var(--lagecto-border)] sm:p-4">
                  <p className="line-clamp-2 text-sm font-semibold sm:text-base">{promo.title}</p>
                  <p className="line-clamp-1 text-xs text-[var(--lagecto-muted)] sm:text-sm">{shop?.name}</p>
                  <p className="mt-1 text-sm text-[#0B6E4F] sm:mt-2">
                    {promo.promo_price != null ? money(promo.promo_price) : promo.discount != null ? `${promo.discount}% off` : "Offer"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 pb-7 sm:pb-10">
        <SectionHeading title="Latest products" />
        {latest.length ? (
          <ProductGrid products={latest.slice(0, 6)} className={PRODUCT_GRID_CLASS} />
        ) : (
          <CatalogEmpty title="No products yet" body="New listings will show here as shops publish them." />
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-7 sm:pb-10">
        <SectionHeading title="Trending shops" href="/shops" linkLabel="See all shops" />
        {trendingShops.length ? (
          <div className={SHOP_GRID_CLASS}>
            {trendingShops.slice(0, 3).map((shop) => (
              <ShopCard
                key={shop.id}
                shop={{
                  id: shop.id,
                  name: shop.name,
                  slug: shop.slug,
                  category: shop.category,
                  address: shop.address,
                  avgRating: Number(shop.avg_rating || 0),
                  totalReviews: Number(shop.total_reviews || 0),
                  isOpen: shopIsOpenNow(shop),
                  logoUrl: shop.logo_url,
                  bannerUrl: shop.banner_url,
                  verificationStatus: shop.verification_status,
                  about: shop.about,
                }}
              />
            ))}
          </div>
        ) : (
          <CatalogEmpty title="Not enough shop activity yet" body="Trending shops are based on recent paid orders, views and new listings." />
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 sm:pb-16">
        <SectionHeading title="Top shops" />
        {(topShops.length ? topShops.slice(0, 4) : shops.slice(0, 4)).length ? (
          <div className={SHOP_GRID_CLASS}>
            {(topShops.length ? topShops.slice(0, 4) : shops.slice(0, 4)).map((shop) =>
              "logoUrl" in shop ? (
                <ShopCard key={shop.id} shop={shop} />
              ) : (
                <ShopCard
                  key={shop.id}
                  shop={{
                    id: shop.id,
                    name: shop.name,
                    slug: shop.slug,
                    category: shop.category,
                    address: shop.address,
                    avgRating: Number(shop.avg_rating || 0),
                    totalReviews: Number(shop.total_reviews || 0),
                    isOpen: shopIsOpenNow(shop),
                    logoUrl: shop.logo_url,
                    bannerUrl: shop.banner_url,
                    verificationStatus: shop.verification_status,
                    about: shop.about,
                  }}
                />
              ),
            )}
          </div>
        ) : (
          <div className="lg-card p-8 text-sm text-[var(--lagecto-muted)]">
            Shops appear here once they are published.{" "}
            <Link href="/register-shop" className="font-medium text-[#0B6E4F]">
              Register a shop
            </Link>
            .
          </div>
        )}
      </section>
    </>
  );
}
