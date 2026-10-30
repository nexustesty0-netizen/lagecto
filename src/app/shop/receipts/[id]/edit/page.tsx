import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { SaleEditor } from "@/components/shop/SaleEditor";

export default async function EditReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { shop } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: receipt } = await supabase.from("receipts").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!receipt) notFound();
  const [{ data: items }, { data: products }] = await Promise.all([
    supabase.from("receipt_items").select("*").eq("receipt_id", id),
    supabase.from("products").select("id, name, price, stock, type, barcode").eq("shop_id", shop.id).order("name"),
  ]);

  return (
    <>
      <PageHeader title={`Correct ${receipt.receipt_number}`} subtitle="Editing a receipt also updates the linked sale and stock." />
      <SaleEditor
        products={products || []}
        record={{
          id: receipt.id,
          kind: "receipt",
          customer_name: receipt.customer_name,
          customer_email: receipt.customer_email,
          customer_phone: receipt.customer_phone,
          payment_method: receipt.payment_method,
          cashier_name: receipt.cashier_name,
          time_taken: receipt.time_taken,
          notes: receipt.notes,
          items: items || [],
        }}
      />
    </>
  );
}
