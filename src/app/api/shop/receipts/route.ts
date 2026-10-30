import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";

function mapItems(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      product_id: row.productId || row.product_id || null,
      name: String(row.name || row.product_name || "").trim(),
      quantity: Number(row.quantity || 1),
      unit_price: Number(row.unitPrice ?? row.unit_price ?? row.price ?? 0),
    };
  });
}

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const action = String(body.action || "update");

  if (action === "delete") {
    const { data, error } = await supabase.rpc("delete_shop_receipt", { p_receipt_id: String(body.id || "") });
    if (error) return NextResponse.json({ error: error.message || "Unable to delete this receipt." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.rpc("update_shop_receipt", {
    p_receipt_id: String(body.id || ""),
    p_items: mapItems(body.items),
    p_customer_name: String(body.customerName || ""),
    p_customer_email: String(body.customerEmail || ""),
    p_customer_phone: String(body.customerPhone || ""),
    p_payment_method: String(body.paymentMethod || "cash"),
    p_cashier_name: String(body.cashierName || ""),
    p_time_taken: String(body.timeTaken || ""),
    p_notes: String(body.notes || ""),
  });
  if (error) return NextResponse.json({ error: error.message || "Unable to update this receipt." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
