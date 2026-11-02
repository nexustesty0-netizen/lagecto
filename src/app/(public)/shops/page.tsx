import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceSearch } from "@/components/public/MarketplaceSearch";
import { PublicHero } from "@/components/public/PublicHero";
import { ShopCard, SHOP_GRID_CLASS } from "@/components/public/ShopCard";
import { MARKETPLACE_IMAGES, getPublicShops } from "@/lib/public-catalog";
import { categoryLabel } from "@/lib/brand";
import { AdStrip } from "@/components/ads/AdStrip";

export const metadata: Metadata = {
  title: "Shops",
  description: "Active LaGecto shops in Bulawayo. Open a storefront to see products, hours and WhatsApp checkout.",
};

export default async function PublicShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const shops = await getPublicShops({ q, category });
  const activeCategory = category && category !== "all" ? category : "all";
  const heading = activeCategory === "all" ? "All shops" : categoryLabel(activeCategory);

  return (
    <>
      <PublicHero
        kicker="Shops"
        title="Find verified local shops"
        subtitle="Browse active LaGecto shops, add to cart, then checkout via WhatsApp. Payment is arranged directly with the shop."
        image={MARKETPLACE_IMAGES.shopsHero}
      />
      <MarketplaceSearch action="/shops" q={q} category={category} placeholder="Search shops..." overlap />
      <AdStrip className="mx-auto max-w-6xl px-4 pt-4 sm:pt-6" />
      <section className="mx-auto max-w-6xl px-4 py-10">
        {!shops.length ? (
          <div className="lg-card p-10 text-center">
            <p className="font-semibold">No shops published yet</p>
            <p className="mt-2 text-sm text-[#6B7280]">
              Check the marketplace for featured products, or request a shop if you sell locally.
            </p>
            <Link href="/register-shop" className="mt-4 inline-block font-semibold text-[#0B6E4F]">
              Register a shop
            </Link>
          </div>
        ) : (
          <section>
            <h2 className="mb-4 text-2xl font-semibold">{heading}</h2>
            <div className={SHOP_GRID_CLASS}>
              {shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          </section>
        )}
      </section>
    </>
  );
}
