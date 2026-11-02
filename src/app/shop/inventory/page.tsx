import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { FeatureLocked, FeatureHint } from "@/components/shop/FeatureLocked";
import { InventoryBoard } from "@/components/shop/InventoryBoard";

export default async function InventoryPage() {
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "inventory");
  if (locked) return <FeatureLocked feature="inventory" reason={locked} />;
  const supabase = await createServerSupabase();
  const [{ data: products }, { data: history }, { data: insights }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, stock, low_stock_threshold, type, category, price, cost, barcode")
      .eq("shop_id", shop.id)
      .eq("type", "product")
      .order("name"),
    supabase
      .from("inventory_transactions")
      .select("id, product_id, transaction_type, quantity, previous_quantity, new_quantity, reason, created_at, created_by")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.rpc("shop_inventory_insights", { p_shop_id: shop.id }),
  ]);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock changes are recorded for your shop only. Completed POS sales reduce stock automatically." />
      <div className="mb-4">
        <FeatureHint feature="inventory" />
      </div>
      {!products?.length ? (
        <EmptyState
          title="No inventory items"
          body="Add products first. Stock quantities and low-stock alerts appear here after you add catalogue items."
          action={
            <Link href="/shop/products" className="inline-flex rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
              Add products
            </Link>
          }
        />
      ) : (
        <InventoryBoard shopId={shop.id} products={products} history={history || []} insights={insights} />
      )}
    </>
  );
}
