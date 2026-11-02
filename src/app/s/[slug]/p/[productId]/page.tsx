import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontCatalog, getStorefrontProduct } from "@/lib/storefront/load";
import { storefrontShareUrl } from "@/lib/storefront/socials";
import { ogImages } from "@/lib/share-preview";
import { hasProductPhoto } from "@/lib/placeholder-cover";
import { BRAND } from "@/lib/brand";
import { CatalogItemDetails } from "@/components/storefront/CatalogItemDetails";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { getProfile } from "@/lib/auth/session";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { slug, productId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) return { title: "Item" };
  const product = await getStorefrontProduct(data.shop.id, productId);
  const title = product?.name || "Item";
  const description = product?.description || `${product?.name || "Item"} from ${data.shop.name}`;
  const url = `${storefrontShareUrl(undefined, slug)}/p/${productId}`;
  const photo = product?.images?.find((src: string) => hasProductPhoto(src));
  const images = ogImages(photo || data.shop.banner_url, title);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: BRAND.name,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images?.map((item) => item.url),
    },
  };
}

export default async function StorefrontProductPage({ params }: { params: Promise<{ slug: string; productId: string }> }) {
  const { slug, productId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const product = await getStorefrontProduct(data.shop.id, productId);
  if (!product) notFound();
  const catalog = await getStorefrontCatalog(data.shop.id);
  const related = [
    ...catalog.filter((item) => item.id !== product.id && item.type === product.type && item.category && item.category === product.category),
    ...catalog.filter((item) => item.id !== product.id && item.type === product.type),
  ]
    .filter((item, index, rows) => rows.findIndex((row) => row.id === item.id) === index)
    .slice(0, 8);
  const profile = await getProfile();

  return (
    <>
      <TrackEvent eventType="product_view" shopId={data.shop.id} productId={product.id} />
      <CatalogItemDetails
        shop={data.shop}
        item={product}
        related={related}
        loggedIn={profile?.role === "customer"}
        showEnquire={profile?.role !== "shop_owner" && profile?.role !== "admin"}
      />
    </>
  );
}
