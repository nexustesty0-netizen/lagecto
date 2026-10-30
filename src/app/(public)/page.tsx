import Link from "next/link";
import Image from "next/image";
import { MarketplaceSearch } from "@/components/public/MarketplaceSearch";
import { ProductGrid, CatalogEmpty, PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { ShopCard, SHOP_GRID_CLASS } from "@/components/public/ShopCard";
import { getPublicShops } from "@/lib/public-catalog";
import {
  getLatestProducts,
  getLiveAds,
  getLivePromotions,
  getMostSoldProducts,
  getTopShops,
  getTrendingProducts,
  getTrendingShops,
} from "@/lib/marketplace/discovery";
import { BRAND } from "@/lib/brand";
import { money } from "@/lib/format";
import { shopIsOpenNow } from "@/lib/hours";

export default async function HomePage() {
  const [trending, mostSold, latest, shops, topShops, trendingShops, ads, promotions] = await Promise.all([
    getTrendingProducts(3),
    getMostSoldProducts(4),
    getLatestProducts(6),
    getPublicShops(),
    getTopShops(4),
    getTrendingShops(3),
    getLiveAds(4),
    getLivePromotions(6),
  ]);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/visuals/public-hero.png" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#073628]/88 via-[#0B6E4F]/55 to-[#073628]/20" />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 text-white lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-24">
          <div className="lg-page">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d4af37]">Bulawayo · Digital commerce</p>
            <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl">
              Shop local businesses with a modern marketplace.
            </h1>
            <p className="mt-4 max-w-lg text-base text-white/85">{BRAND.tagline}. Discover shops, checkout via WhatsApp, and collect nearby.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/marketplace"
                className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold"
                style={{ color: "var(--lagecto-primary)" }}
              >
                Explore marketplace
              </Link>
              <Link href="/register-shop" className="rounded-full border border-white/30 px-5 py-3 text-center text-sm font-semibold text-white">
                Register a shop
              </Link>
            </div>
          </div>
          <div className="lg-card hidden p-5 text-[#12241c] lg:block">
            <p className="text-sm font-semibold">Why people use LaGecto</p>
            <ul className="mt-4 grid gap-3 text-sm text-[var(--lagecto-muted)]">
              <li>Every shop gets its own storefront</li>
              <li>Checkout via WhatsApp with each shop</li>
              <li>Receipts, orders and support in-app</li>
            </ul>
          </div>
        </div>
      </section>
      <MarketplaceSearch action="/marketplace" overlap />

      {ads.length ? (
        <section className="mx-auto max-w-6xl px-4 pt-8">
          <div className="grid gap-3 md:grid-cols-2">
            {ads.map((ad: { id: string; title: string; body?: string | null; image_url?: string | null; destination_kind: string; destination_id?: string | null }) => {
              const href =
                ad.destination_kind === "shop" && ad.destination_id
                  ? `/s/${ad.destination_id}`
                  : ad.destination_kind === "category" && ad.destination_id
                    ? `/marketplace?category=${ad.destination_id}`
                    : "/marketplace";
              return (
                <Link key={ad.id} href={href} className="lg-card overflow-hidden">
                  {ad.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.image_url} alt="" className="h-40 w-full object-cover" />
                  ) : null}
                  <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B6E4F]">Promoted</p>
                    <p className="mt-1 font-semibold">{ad.title}</p>
                    {ad.body ? <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{ad.body}</p> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0B6E4F]">Activity</p>
            <h2 className="mt-1 text-2xl font-semibold">Trending products</h2>
          </div>
          <Link href="/marketplace?sort=popular" className="text-sm font-medium text-[#0B6E4F]">
            See marketplace
          </Link>
        </div>
        {trending.length ? (
          <ProductGrid products={trending.slice(0, 3)} className={PRODUCT_GRID_CLASS} />
        ) : (
          <CatalogEmpty title="Not enough activity yet" body="Trending products appear after recent views, carts and paid sales." href="/marketplace" label="Browse catalogue" />
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <h2 className="mb-5 text-2xl font-semibold">Most sold</h2>
        {mostSold.length ? (
          <ProductGrid products={mostSold.slice(0, 4)} className={PRODUCT_GRID_CLASS} />
        ) : (
          <CatalogEmpty title="No paid sales yet" body="Most-sold products are counted from completed paid orders and POS sales." />
        )}
      </section>

      {promotions.length ? (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <h2 className="mb-5 text-2xl font-semibold">Special offers</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promo: { id: string; title: string; discount: number | null; promo_price: number | null; shops?: { name?: string; slug?: string } | { name?: string; slug?: string }[] }) => {
              const shop = Array.isArray(promo.shops) ? promo.shops[0] : promo.shops;
              return (
                <Link key={promo.id} href={shop?.slug ? `/s/${shop.slug}/promotions` : "/marketplace"} className="lg-card p-4">
                  <p className="font-semibold">{promo.title}</p>
                  <p className="text-sm text-[var(--lagecto-muted)]">{shop?.name}</p>
                  <p className="mt-2 text-[#0B6E4F]">
                    {promo.promo_price != null ? money(promo.promo_price) : promo.discount != null ? `${promo.discount}% off` : "Offer"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <h2 className="mb-5 text-2xl font-semibold">Latest products</h2>
        {latest.length ? (
          <ProductGrid products={latest.slice(0, 6)} className={PRODUCT_GRID_CLASS} />
        ) : (
          <CatalogEmpty title="No products yet" body="New listings will show here as shops publish them." />
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-semibold">Trending shops</h2>
          <Link href="/shops" className="text-sm font-medium text-[#0B6E4F]">See all shops</Link>
        </div>
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

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-5 text-2xl font-semibold">Top shops</h2>
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
