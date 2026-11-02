import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontCatalog } from "@/lib/storefront/load";
import { PricedProductCard } from "@/components/storefront/PricedProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { StorefrontCatalogList, withPhotos } from "@/components/storefront/StorefrontCatalogList";
import { StorefrontPageHeader } from "@/components/storefront/StorefrontPageHeader";
import { filterCatalog, isTechStorefront, techPageTitle } from "@/lib/storefront/template";
import { TechCatalogPage } from "@/components/storefront/tech/TechInnerPages";
import { storefrontOgDescription } from "@/lib/storefront/og";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Products" };
  return {
    title: isTechStorefront(data.shop, data.config) ? techPageTitle(data.shop, "products") : `Products · ${data.shop.name}`,
    description: storefrontOgDescription({
      name: data.shop.name,
      meta_description: data.shop.meta_description,
      tagline: data.config?.tagline,
      about: data.shop.about,
    }),
  };
}

export default async function StorefrontProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const products = filterCatalog(
    (await getStorefrontCatalog(data.shop.id, "product")).filter((item) => item.type === "product"),
    q,
  );
  if (isTechStorefront(data.shop, data.config)) {
    return (
      <TechCatalogPage
        shop={data.shop}
        title="Products"
        subtitle={q ? `Results for “${q}”` : `${products.length ? `${products.length} piece${products.length === 1 ? "" : "s"}` : "New pieces"} from ${data.shop.name}.`}
        items={products}
        empty={q ? "No products match that search." : "Not enough products published yet."}
        kind="product"
      />
    );
  }
  const pictured = withPhotos(products);
  return (
    <>
      <StorefrontPageHeader
        kicker="Collection"
        title="Products"
        subtitle={`${products.length ? `${products.length} piece${products.length === 1 ? "" : "s"}` : "New pieces"} from ${data.shop.name}.`}
        image={data.shop.banner_url}
      />
      <section className="mx-auto max-w-6xl px-4 pb-16">
        {!products.length ? (
          <p className="text-sm" style={{ color: "var(--sf-muted)" }}>
            Not enough products published yet.
          </p>
        ) : (
          <>
            {pictured.length ? (
              <div className={`sf-reveal ${PRODUCT_GRID_CLASS}`}>
                {pictured.map((item) => (
                  <PricedProductCard key={item.id} product={item} shop={data.shop} />
                ))}
              </div>
            ) : null}
            <StorefrontCatalogList title="Products" items={products} shop={data.shop} embedded />
          </>
        )}
      </section>
    </>
  );
}
