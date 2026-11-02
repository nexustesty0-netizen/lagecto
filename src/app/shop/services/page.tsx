import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { CatalogManager } from "@/components/shop/CatalogManager";
import { FeatureHint } from "@/components/shop/FeatureLocked";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { countStoredCatalogImages } from "@/lib/media";

export default async function ServicesPage() {
  const { shop, subscription } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  if (shop.provider_type === "products") {
    return (
      <EmptyState
        title="Services not enabled"
        body="This shop is set to products only. Change the shop type in Settings if you also offer services."
        action={
          <Link href="/shop/settings" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
            Open settings
          </Link>
        }
      />
    );
  }
  const supabase = await createServerSupabase();
  const [{ data: services }, { data: categories }, { data: catalogImages }] = await Promise.all([
    supabase.from("products").select("*").eq("shop_id", shop.id).eq("type", "service").order("name"),
    supabase.from("product_categories").select("id, name").eq("shop_id", shop.id).order("name"),
    supabase.from("products").select("image").eq("shop_id", shop.id),
  ]);
  return (
    <>
      <PageHeader title="Services" subtitle="Bookable services for this shop. Price and duration are optional." />
      <div className="mb-4">
        <FeatureHint feature="product_listings" />
      </div>
      <CatalogManager
        shopId={shop.id}
        kind="service"
        items={services || []}
        categories={categories || []}
        packageKey={subscription.packageKey}
        deviceImageUsed={countStoredCatalogImages((catalogImages || []).map((row) => row.image))}
      />
    </>
  );
}
