import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop } from "@/lib/auth/session";
import { ReceiptView } from "@/components/receipts/ReceiptView";

export default async function ShopReceiptDetailPage({
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
  const { data: items } = await supabase.from("receipt_items").select("*").eq("receipt_id", id);
  return <ReceiptView receipt={{ ...receipt, items: items || [] }} backHref="/shop/receipts" canManage />;
}
