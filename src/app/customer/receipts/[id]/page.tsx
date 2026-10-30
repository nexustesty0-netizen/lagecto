import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { ReceiptView } from "@/components/receipts/ReceiptView";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: receipt } = await supabase.from("receipts").select("*").eq("id", id).eq("customer_id", profile.id).maybeSingle();
  if (!receipt) notFound();
  const { data: items } = await supabase.from("receipt_items").select("*").eq("receipt_id", id);
  return <ReceiptView receipt={{ ...receipt, items: items || [] }} backHref="/customer/receipts" />;
}
