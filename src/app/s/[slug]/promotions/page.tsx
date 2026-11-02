import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontExtras } from "@/lib/storefront/load";
import { StorefrontPageHeader } from "@/components/storefront/StorefrontPageHeader";
import { StorefrontPromoCard } from "@/components/storefront/StorefrontPromoCard";
import { isTechStorefront, techPageTitle } from "@/lib/storefront/template";
import { TechPromotionsPage } from "@/components/storefront/tech/TechInnerPages";
import { storefrontOgDescription } from "@/lib/storefront/og";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Promotions" };
  return {
    title: isTechStorefront(data.shop, data.config) ? techPageTitle(data.shop, "promotions") : `Promotions · ${data.shop.name}`,
    description: storefrontOgDescription({
      name: data.shop.name,
      meta_description: data.shop.meta_description,
      tagline: data.config?.tagline,
      about: data.shop.about,
    }),
  };
}

export default async function StorefrontPromotionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const extras = await getStorefrontExtras(data.shop.id);
  if (isTechStorefront(data.shop, data.config)) {
    return <TechPromotionsPage shop={data.shop} config={data.config} promotions={extras.promotions} />;
  }
  const [featured, ...rest] = extras.promotions;
  return (
    <>
      <StorefrontPageHeader
        kicker="Offers"
        title="Promotions"
        subtitle={`Live deals from ${data.shop.name}. New offers appear here while they are running.`}
        image={data.shop.banner_url}
      />
      <section className="mx-auto max-w-6xl px-4 pb-16">
        {!extras.promotions.length ? (
          <div className="sf-card p-10 text-center">
            <p className="sf-live mx-auto">Quiet</p>
            <p className="mt-4 text-lg font-semibold">No live promotions right now</p>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>
              Check back soon — this shop posts offers on this page.
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            <StorefrontPromoCard promo={featured} featured />
            {rest.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {rest.map((promo) => (
                  <StorefrontPromoCard key={promo.id} promo={promo} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
