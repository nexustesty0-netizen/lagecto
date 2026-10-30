import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ReceiptView } from "@/components/receipts/ReceiptView";

export default async function AdminReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: receipt } = await supabase.from("platform_receipts").select("*").eq("id", id).maybeSingle();
  if (!receipt) notFound();
  const { data: items } = await supabase.from("platform_receipt_items").select("*").eq("receipt_id", id);
  return (
    <ReceiptView
      backHref="/admin/receipts"
      receipt={{
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        created_at: receipt.created_at,
        customer_name: receipt.customer_name,
        payment_method: receipt.payment_method,
        payment_status: "paid",
        subtotal: Number(receipt.subtotal || 0),
        discount: 0,
        tax: 0,
        total: Number(receipt.total || 0),
        shop_details: { ...(receipt.shop_details as object || {}), kind: "platform", template: "premium" },
        items: (items || []).map((item) => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price || 0),
          total_price: Number(item.total_price || 0),
        })),
      }}
    />
  );
}
