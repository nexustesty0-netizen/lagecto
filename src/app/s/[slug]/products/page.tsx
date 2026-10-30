import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontCatalog } from "@/lib/storefront/load";
import { PricedProductCard } from "@/components/storefront/PricedProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";

export default async function StorefrontProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const products = (await getStorefrontCatalog(data.shop.id, "product")).filter((item) => item.type === "product");
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Products</h1>
      {!products.length ? (
        <p className="mt-6 text-sm" style={{ color: "var(--sf-muted)" }}>
          Not enough products published yet.
        </p>
      ) : (
        <div className={`mt-6 ${PRODUCT_GRID_CLASS}`}>
          {products.map((item) => (
            <PricedProductCard key={item.id} product={item} shop={data.shop} />
          ))}
        </div>
      )}
    </section>
  );
}
