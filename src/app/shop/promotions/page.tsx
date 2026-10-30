import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { PromotionManager } from "@/components/shop/PromotionManager";
import { FeatureHint } from "@/components/shop/FeatureLocked";

export default async function PromotionsPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const [{ data: promotions }, { data: catalog }] = await Promise.all([
    supabase.from("promotions").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    supabase.from("products").select("id, name, price, type").eq("shop_id", shop.id).eq("is_available", true).order("name"),
  ]);
  return (
    <>
      <PageHeader title="Promotions" subtitle="Sale prices are validated on the server. Expired promotions never apply at checkout. Promo codes live under Customer loyalty." />
      <div className="mb-4">
        <FeatureHint feature="promotions" />
      </div>
      <PromotionManager shopId={shop.id} promotions={promotions || []} catalog={catalog || []} />
    </>
  );
}
