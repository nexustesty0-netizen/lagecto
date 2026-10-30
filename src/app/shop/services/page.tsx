import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { CatalogManager } from "@/components/shop/CatalogManager";
import { FeatureHint } from "@/components/shop/FeatureLocked";

export default async function ServicesPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  if (shop.provider_type === "products") {
    return <EmptyState title="Services not enabled" body="This shop is set to products only." />;
  }
  const supabase = await createServerSupabase();
  const [{ data: services }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("shop_id", shop.id).eq("type", "service").order("name"),
    supabase.from("product_categories").select("id, name").eq("shop_id", shop.id).order("name"),
  ]);
  return (
    <>
      <PageHeader title="Services" subtitle="Bookable services for this shop. Duration is optional." />
      <div className="mb-4">
        <FeatureHint feature="product_listings" />
      </div>
      <CatalogManager shopId={shop.id} kind="service" items={services || []} categories={categories || []} />
    </>
  );
}
