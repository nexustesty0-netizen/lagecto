import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { CatalogManager } from "@/components/shop/CatalogManager";
import { FeatureHint } from "@/components/shop/FeatureLocked";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { countStoredCatalogImages } from "@/lib/media";
import { soldQuantities } from "@/lib/shop/inventory-math";

export default async function ProductsPage() {
  const { shop, subscription } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  if (shop.provider_type === "services") {
    return (
      <EmptyState
        title="Products not enabled"
        body="This shop is set to services only. Change the shop type in Settings if you also sell products."
        action={
          <Link href="/shop/settings" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
            Open settings
          </Link>
        }
      />
    );
  }
  const supabase = await createServerSupabase();
  const [{ data: products }, { data: categories }, { data: soldRows }, { data: catalogImages }] = await Promise.all([
    supabase.from("products").select("*").eq("shop_id", shop.id).eq("type", "product").order("name").limit(400),
    supabase.from("product_categories").select("id, name").eq("shop_id", shop.id).order("name"),
    supabase
      .from("sales")
      .select("sale_items(product_id, quantity)")
      .eq("shop_id", shop.id)
      .eq("status", "completed")
      .limit(200),
    supabase.from("products").select("image").eq("shop_id", shop.id),
  ]);
  const soldById = soldQuantities(
    (soldRows || []).flatMap((sale) => {
      const items = Array.isArray(sale.sale_items) ? sale.sale_items : [];
      return items as { product_id?: string | null; quantity?: number | null }[];
    }),
  );

  return (
    <>
      <PageHeader title="Products" subtitle="Add, edit, hide or delete products for this shop only. Stock changes after create are recorded in Inventory." />
      <div className="mb-4">
        <FeatureHint feature="product_listings" />
      </div>
      <CatalogManager
        shopId={shop.id}
        kind="product"
        items={products || []}
        categories={categories || []}
        soldById={soldById}
        packageKey={subscription.packageKey}
        deviceImageUsed={countStoredCatalogImages((catalogImages || []).map((row) => row.image))}
      />
    </>
  );
}
