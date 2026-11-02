import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { CategoryManager } from "@/components/shop/CategoryManager";

export default async function CategoriesPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: categories } = await supabase.from("product_categories").select("*").eq("shop_id", shop.id).order("sort_order");
  return (
    <>
      <PageHeader title="Categories" subtitle="Add, rename or delete groups for this shop’s products and services." />
      <CategoryManager shopId={shop.id} categories={categories || []} />
    </>
  );
}
