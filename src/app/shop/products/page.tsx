import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { CatalogManager } from "@/components/shop/CatalogManager";
import { FeatureHint } from "@/components/shop/FeatureLocked";

export default async function ProductsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  if (shop.provider_type === "services") {
    return <EmptyState title="Products not enabled" body="This shop is set to services only." />;
  }
  const supabase = await createServerSupabase();
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("shop_id", shop.id).eq("type", "product").order("name"),
    supabase.from("product_categories").select("id, name").eq("shop_id", shop.id).order("name"),
  ]);

  return (
    <>
      <PageHeader title="Products" subtitle="Add, edit, hide or delete products for this shop only." />
      <div className="mb-4">
        <FeatureHint feature="product_listings" />
      </div>
      <CatalogManager shopId={shop.id} kind="product" items={products || []} categories={categories || []} />
    </>
  );
}
