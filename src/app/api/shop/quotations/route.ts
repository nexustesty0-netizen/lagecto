import { NextResponse } from "next/server";
import { jsonError, publicRpcMessage } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopManage } from "@/lib/auth/session";

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
  const auth = await requireApiShopManage();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const action = String(body.action || "save");

  if (action === "delete") {
    const { data, error } = await supabase.rpc("delete_shop_quotation", { p_quotation_id: String(body.id || "") });
    if (error) return jsonError("shop.quotations.delete", "Unable to delete this quotation.", 400, error);
    if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to delete this quotation.") }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.rpc("upsert_shop_quotation", {
    p_shop_id: auth.shop.id,
    p_payload: {
      id: body.id || null,
      format: body.format,
      status: body.status,
      customer_name: body.customerName,
      customer_email: body.customerEmail,
      customer_phone: body.customerPhone,
      customer_id: body.customerId || null,
      valid_until: body.validUntil || null,
      notes: body.notes || "",
      items: mapItems(body.items),
    },
  });
  if (error) return jsonError("shop.quotations.save", "Unable to save this quotation.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to save this quotation.") }, { status: 400 });
  return NextResponse.json(data);
}
