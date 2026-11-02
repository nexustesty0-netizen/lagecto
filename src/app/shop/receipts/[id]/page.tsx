import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { ReceiptView } from "@/components/receipts/ReceiptView";
import { staffCanManage } from "@/lib/shop/staff";

export default async function ShopReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { shop, staffRole } = await getOwnedShop();
  if (!shop) return null;
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabase();
  const { data: receipt } = await supabase.from("receipts").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!receipt) notFound();
  const { data: items } = await supabase.from("receipt_items").select("*").eq("receipt_id", id);
  return (
    <ReceiptView
      receipt={{ ...receipt, items: items || [] }}
      backHref="/shop/receipts"
      canManage={staffCanManage(staffRole)}
      autoPrint={query.print === "1"}
    />
  );
}
