import { NextResponse } from "next/server";
import { jsonError, publicRpcMessage } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopManage } from "@/lib/auth/session";
import { loadEffectivePrices } from "@/lib/pricing";
import { mapShopTicketItems, priceShopTicketItems, SHOP_TICKET_CATALOG_SELECT, type PosCatalogProduct } from "@/lib/shop/pos";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "update");
  const gate = await requireApiShopManage();
  if (!gate.ok) return gate.error;
  const supabase = await createServerSupabase();

  if (action === "delete") {
    const { data, error } = await supabase.rpc("delete_shop_sale", { p_sale_id: String(body.id || "") });
    if (error) return jsonError("shop.sales.delete", "Unable to delete this sale.", 400, error);
    if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to delete this sale.") }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "clear") {
    const { data, error } = await supabase.rpc("clear_shop_sales");
    if (error) return jsonError("shop.sales.clear", "Unable to clear sales.", 400, error);
    if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to clear sales.") }, { status: 400 });
    return NextResponse.json(data);
  }

  const resolved = await priceShopTicketItems(
    mapShopTicketItems(body.items),
    async (ids) =>
      ((await supabase.from("products").select(SHOP_TICKET_CATALOG_SELECT).eq("shop_id", gate.shop.id).in("id", ids))
        .data || []) as PosCatalogProduct[],
    (ids) => loadEffectivePrices((args) => supabase.rpc("product_prices_for_ids", args), ids),
  );
  const ticket = resolved.items;
  if (!ticket) {
    return NextResponse.json({ error: resolved.error || "Unable to price this sale." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("update_shop_sale", {
    p_sale_id: String(body.id || ""),
    p_items: ticket,
    p_customer_name: String(body.customerName || ""),
    p_payment_method: String(body.paymentMethod || "cash"),
    p_cashier_name: String(body.cashierName || ""),
    p_time_taken: String(body.timeTaken || ""),
    p_notes: String(body.notes || ""),
    p_customer_id: String(body.customerId || "").match(/^[0-9a-f-]{36}$/i) ? String(body.customerId) : null,
    p_customer_email: String(body.customerEmail || ""),
    p_customer_phone: String(body.customerPhone || ""),
  });
  if (error) return jsonError("shop.sales.update", "Unable to update this sale.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to update this sale.") }, { status: 400 });
  return NextResponse.json(data);
}
