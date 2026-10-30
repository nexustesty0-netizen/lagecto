import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";
import { getShopFeatures } from "@/lib/entitlements";

type PosItemBody = {
  productId?: string;
  product_id?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  price?: number;
};

function mapItems(items: PosItemBody[]) {
  return items.map((item) => ({
    product_id: item.productId || item.product_id || null,
    name: String(item.name || "").trim(),
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unitPrice ?? item.unit_price ?? item.price ?? 0),
  }));
}

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const { shop, profile } = auth;
  const features = await getShopFeatures(shop.id);
  if (!features.has("pos")) {
    return NextResponse.json({ error: "POS is not included in this shop’s current package." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? mapItems(body.items) : [];
  if (!items.length) {
    return NextResponse.json({ error: "Add a catalogue item or type a custom service." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_pos_sale", {
    p_shop_id: shop.id,
    p_items: items,
    p_payment_method: String(body.paymentMethod || "cash"),
    p_customer_name: String(body.customerName || ""),
    p_cashier_name: String(body.cashierName || profile.name || ""),
    p_time_taken: String(body.timeTaken || ""),
    p_notes: String(body.notes || ""),
    p_customer_id: String(body.customerId || "").match(/^[0-9a-f-]{36}$/i) ? String(body.customerId) : null,
  });
  if (error) return NextResponse.json({ error: error.message || "Unable to record this sale." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
