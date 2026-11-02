import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontCatalog, getStorefrontExtras } from "@/lib/storefront/load";
import { TechHome } from "@/components/storefront/tech/TechHome";

export default async function StorefrontHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data) notFound();
  const { shop, config } = data;
  const [catalog, extras] = await Promise.all([getStorefrontCatalog(shop.id), getStorefrontExtras(shop.id)]);
  const products = catalog.filter((item) => item.type === "product");
  const services = catalog.filter((item) => item.type === "service");
  return (
    <TechHome
      shop={shop}
      config={config}
      products={products}
      services={services}
      promotions={extras.promotions}
      media={extras.media}
      videos={extras.videos}
      posts={extras.posts}
      reviews={extras.reviews}
      projects={extras.projects}
    />
  );
}
