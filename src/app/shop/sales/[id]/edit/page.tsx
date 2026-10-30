import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { SaleEditor } from "@/components/shop/SaleEditor";

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: sale } = await supabase.from("sales").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!sale) notFound();
  const [{ data: items }, { data: products }, { data: receipt }] = await Promise.all([
    supabase.from("sale_items").select("*").eq("sale_id", id),
    supabase.from("products").select("id, name, price, stock, type, barcode").eq("shop_id", shop.id).order("name"),
    supabase.from("receipts").select("customer_email, customer_phone").eq("sale_id", id).maybeSingle(),
  ]);

  return (
    <>
      <PageHeader title={`Correct ${sale.sale_number || "sale"}`} subtitle="Only for mistakes in the current financial period. Stock is adjusted to match the new lines." />
      <SaleEditor
        products={products || []}
        record={{
          id: sale.id,
          kind: "sale",
          customer_name: sale.customer_name,
          customer_email: receipt?.customer_email,
          customer_phone: receipt?.customer_phone,
          payment_method: sale.payment_method,
          cashier_name: sale.cashier_name,
          time_taken: sale.time_taken,
          notes: sale.notes,
          items: items || [],
        }}
      />
    </>
  );
}
