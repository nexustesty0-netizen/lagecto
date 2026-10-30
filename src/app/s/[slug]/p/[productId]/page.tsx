import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontProduct } from "@/lib/storefront/load";
import { getRecommendations } from "@/lib/marketplace/discovery";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { PricedProductCard } from "@/components/storefront/PricedProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/public/ProductCard";
import { money } from "@/lib/format";
import { getProfile } from "@/lib/auth/session";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { MediaPreview } from "@/components/media/MediaPreview";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Product" };
  const product = await getStorefrontProduct(data.shop.id, productId);
  return {
    title: product?.name || "Product",
    description: product?.description || `${product?.name || "Product"} from ${data.shop.name}`,
    openGraph: { images: product?.images?.[0] ? [{ url: product.images[0] }] : undefined },
  };
}

export default async function StorefrontProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const product = await getStorefrontProduct(data.shop.id, productId);
  if (!product) notFound();
  const profile = await getProfile();
  const related = await getRecommendations({
    userId: profile?.id,
    productId: product.id,
    shopId: data.shop.id,
    limit: 8,
  });
  const onSale = product.onSale && product.unitPrice < product.listPrice;
  const pct = onSale && product.listPrice > 0 ? Math.round(((product.listPrice - product.unitPrice) / product.listPrice) * 100) : 0;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <TrackEvent eventType="product_view" shopId={data.shop.id} productId={product.id} />
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--sf-muted)" }}>
            {data.shop.name} · {product.type}
            <VerifiedBadge verified={data.shop.verified} />
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
          <p className="mt-4 text-2xl font-semibold">
            {money(product.unitPrice)}
            {onSale ? (
              <>
                <span className="ml-3 text-lg font-normal line-through opacity-50">{money(product.listPrice)}</span>
                <span className="ml-2 text-sm">-{pct}%</span>
              </>
            ) : null}
          </p>
          {product.description ? <p className="mt-4 leading-7">{product.description}</p> : null}
          {product.video_url ? <MediaPreview url={product.video_url} title={product.name} className="mt-5 w-full rounded-[22px]" /> : null}
          {product.type === "service" && product.duration ? (
            <p className="mt-3 text-sm" style={{ color: "var(--sf-muted)" }}>
              Duration: {product.duration}
            </p>
          ) : null}
          {product.type === "product" ? (
            <p className="mt-3 text-sm" style={{ color: "var(--sf-muted)" }}>
              {Number(product.stock || 0) > 0 ? `${product.stock} in stock` : "Out of stock"}
            </p>
          ) : null}
          <AddToCartButton
            product={{
              productId: product.id,
              shopId: data.shop.id,
              shopName: data.shop.name,
              name: product.name,
              price: product.unitPrice,
              image: product.images[0],
              type: product.type,
            }}
          />
        </div>
      </div>
      {related.length ? (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold">You may also like</h2>
          <div className={`mt-5 ${PRODUCT_GRID_CLASS}`}>
            {related.map((item) => (
              <PricedProductCard key={item.id} product={item} shop={{ id: item.shopId, slug: item.shopSlug, name: item.shopName }} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
