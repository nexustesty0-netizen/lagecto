import { NextResponse } from "next/server";
import { jsonError, publicRpcMessage } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";
import { getShopFeatures } from "@/lib/entitlements";
import { loadEffectivePrices } from "@/lib/pricing";
import { staffCanManage } from "@/lib/shop/staff";
import {
  applyAuthorisedDiscount,
  mapShopTicketItems,
  normalizeIdempotencyKey,
  priceShopTicketItems,
  SHOP_TICKET_CATALOG_SELECT,
  type PosCatalogProduct,
} from "@/lib/shop/pos";

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const { shop, profile, staffRole } = auth;
  const features = await getShopFeatures(shop.id);
  if (!features.has("pos")) {
    return NextResponse.json({ error: "POS is not included in this shop’s current package." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const requested = mapShopTicketItems(body.items);
  if (!requested.length) {
    return NextResponse.json({ error: "Add a catalogue item or type a custom service." }, { status: 400 });
  }
  const invalid = requested.some(
    (item) => !Number.isFinite(item.quantity) || item.quantity < 1 || (!item.product_id && !item.name),
  );
  if (invalid) {
    return NextResponse.json({ error: "Each line needs a name and a quantity of at least 1." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const resolved = await priceShopTicketItems(
    requested,
    async (ids) =>
      ((await supabase.from("products").select(SHOP_TICKET_CATALOG_SELECT).eq("shop_id", shop.id).in("id", ids)).data ||
        []) as PosCatalogProduct[],
    (ids) => loadEffectivePrices((args) => supabase.rpc("product_prices_for_ids", args), ids),
  );
  const ticket = resolved.items;
  if (!ticket) {
    return NextResponse.json({ error: resolved.error || "Unable to price this sale." }, { status: 400 });
  }

  const canDiscount = staffCanManage(staffRole);
  const priced = posTicketCharged(ticket);
  const discount = applyAuthorisedDiscount(priced, Number(body.extraDiscount || 0), canDiscount);

  const { data, error } = await supabase.rpc("record_pos_sale", {
    p_shop_id: shop.id,
    p_items: ticket,
    p_payment_method: String(body.paymentMethod || "cash"),
    p_customer_name: String(body.customerName || ""),
    p_cashier_name: String(body.cashierName || profile.name || ""),
    p_time_taken: String(body.timeTaken || ""),
    p_notes: String(body.notes || ""),
    p_customer_id: String(body.customerId || "").match(/^[0-9a-f-]{36}$/i) ? String(body.customerId) : null,
    p_idempotency_key: normalizeIdempotencyKey(body.idempotencyKey),
    p_extra_discount: discount.extra,
  });
  if (error) return jsonError("shop.pos", "Unable to record this sale.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to record this sale.") }, { status: 400 });
  return NextResponse.json(data);
}

function posTicketCharged(items: { unit_price: number; quantity: number }[]) {
  return Number(items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0).toFixed(2));
}
