import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { SupplierManager } from "@/components/shop/SupplierManager";

export default async function SuppliersPage() {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const { data: suppliers } = await supabase.from("suppliers").select("*").eq("shop_id", shop.id).order("name");
  return (
    <>
      <PageHeader title="Suppliers" subtitle="Keep contact details and a note of what each supplier provides." />
      <SupplierManager shopId={shop.id} suppliers={suppliers || []} />
    </>
  );
}
