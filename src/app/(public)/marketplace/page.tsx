import type { Metadata } from "next";
import { MarketplaceSearch } from "@/components/public/MarketplaceSearch";
import { PublicHero } from "@/components/public/PublicHero";
import { ProductGrid, CatalogEmpty } from "@/components/public/ProductCard";
import { ShopCard, SHOP_GRID_CLASS } from "@/components/public/ShopCard";
import { getLatestShops, getTrendingShops, searchCatalog, toPublicShop, type CatalogSort } from "@/lib/marketplace/discovery";
import { AdStrip } from "@/components/ads/AdStrip";
import { SectionHeading } from "@/components/ui/primitives";
import { titleCase } from "@/lib/format";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse live products and services from LaGecto shops in Bulawayo. Checkout is on WhatsApp with each shop.",
};

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    type?: string;
    sort?: string;
    min?: string;
    max?: string;
    sale?: string;
  }>;
}) {
  const { q, category, type, sort, min, max, sale } = await searchParams;
  const [products, latestShops, trendingShops] = await Promise.all([
    searchCatalog({
      q,
      category,
      type: type === "service" || type === "product" ? type : "all",
      sort: (sort as CatalogSort) || "relevance",
      minPrice: min ? Number(min) : undefined,
      maxPrice: max ? Number(max) : undefined,
      onSale: sale === "1",
      limit: 48,
    }),
    getLatestShops(4),
    getTrendingShops(4),
  ]);
  const heading = category && category !== "all" ? titleCase(category) : "Marketplace";
  const latestCards = latestShops.slice(0, 4).map(toPublicShop);
  const trendingCards = trendingShops.map(toPublicShop);

  return (
    <>
      <PublicHero
        slideshow
        kicker="Shop local"
        title={heading}
        subtitle={q ? `Results for “${q}”` : "Browse live products and services from LaGecto shops"}
      />
      <MarketplaceSearch q={q} category={category} overlap />
      <AdStrip className="mx-auto max-w-6xl px-4 pt-4 sm:pt-6" />
      <section className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
        <form className="mb-4 grid grid-cols-1 gap-3 rounded-[var(--lg-radius)] border border-[var(--lagecto-border)] bg-white p-3 sm:mb-6 sm:grid-cols-5 sm:p-4">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <label className="grid min-w-0 gap-1 text-xs font-medium text-[var(--lagecto-muted)]">
            Type
            <select name="type" defaultValue={type || "all"} className="h-11 w-full min-w-0 max-w-full rounded-xl border bg-[var(--lagecto-ivory)] px-3 text-sm text-[var(--lagecto-text)]">
              <option value="all">All</option>
              <option value="product">Products</option>
              <option value="service">Services</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-medium text-[var(--lagecto-muted)]">
            Sort
            <select name="sort" defaultValue={sort || "relevance"} className="h-11 w-full min-w-0 max-w-full rounded-xl border bg-[var(--lagecto-ivory)] px-3 text-sm text-[var(--lagecto-text)]">
              <option value="relevance">Relevance</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="popular">Popular</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:contents">
            <label className="grid min-w-0 gap-1 text-xs font-medium text-[var(--lagecto-muted)]">
              Min price
              <input name="min" type="number" min={0} inputMode="decimal" defaultValue={min} className="h-11 w-full min-w-0 max-w-full rounded-xl border bg-[var(--lagecto-ivory)] px-3 text-sm text-[var(--lagecto-text)]" />
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-[var(--lagecto-muted)]">
              Max price
              <input name="max" type="number" min={0} inputMode="decimal" defaultValue={max} className="h-11 w-full min-w-0 max-w-full rounded-xl border bg-[var(--lagecto-ivory)] px-3 text-sm text-[var(--lagecto-text)]" />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="sale" value="1" defaultChecked={sale === "1"} className="h-4 w-4 accent-[#0B6E4F]" />
            On promotion
          </label>
          <button className="lg-btn w-full sm:col-span-5">Apply filters</button>
        </form>
        <p className="mb-3 text-xs text-[#6B7280] sm:mb-4 sm:text-sm">{products.length} items</p>
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <CatalogEmpty title="No matching items" body="Try another search or clear filters. Empty results are shown instead of placeholder products." />
        )}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-7 sm:pb-10">
        <SectionHeading title="Latest shops" kicker="New on LaGecto" href="/shops" linkLabel="See all shops" />
        {latestCards.length ? (
          <div className={SHOP_GRID_CLASS}>
            {latestCards.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        ) : (
          <CatalogEmpty title="No shops yet" body="New shops appear here after they are published." href="/register-shop" label="Register a shop" />
        )}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:pb-16">
        <SectionHeading title="Trending shops" href="/shops" linkLabel="See all shops" />
        {trendingCards.length ? (
          <div className={SHOP_GRID_CLASS}>
            {trendingCards.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        ) : (
          <CatalogEmpty title="Not enough shop activity yet" body="Trending shops are based on recent paid orders, views and new listings." />
        )}
      </section>
    </>
  );
}
