import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceSearch } from "@/components/public/MarketplaceSearch";
import { ShopCard, SHOP_GRID_CLASS } from "@/components/public/ShopCard";
import { MARKETPLACE_IMAGES, getPublicShops, groupShopsByCategory } from "@/lib/public-catalog";

export const metadata: Metadata = { title: "Shops" };

export default async function PublicShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const shops = await getPublicShops({ q, category });
  const groups = groupShopsByCategory(shops);

  return (
    <>
      <section className="relative overflow-hidden bg-[#0B6E4F] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={MARKETPLACE_IMAGES.shopsHero}
          alt="Local shops on a sunny street"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80">Shops</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold sm:text-4xl">Find verified local shops</h1>
          <p className="mt-3 max-w-xl text-white/85">
            Browse active LaGecto shops, add to cart, then checkout via WhatsApp. Payment is arranged directly with the shop.
          </p>
        </div>
      </section>
      <MarketplaceSearch action="/shops" q={q} category={category} placeholder="Search shops..." overlap />
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
          <div className="grid gap-10">
            {groups.map((group) => (
              <section key={group.slug}>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <h2 className="text-2xl font-semibold">{group.label}</h2>
                  {!category || category === "all" ? (
                    <Link href={`/shops?category=${group.slug}`} className="text-sm font-medium text-[#0B6E4F]">
                      {`See ${group.label} shops`}
                    </Link>
                  ) : null}
                </div>
                <div className={SHOP_GRID_CLASS}>
                  {group.shops.map((shop) => (
                    <ShopCard key={shop.id} shop={shop} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
