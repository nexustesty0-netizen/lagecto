import { NextResponse } from "next/server";
import { jsonError, publicRpcMessage } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop, requireApiShopManage } from "@/lib/auth/session";
import { loadEffectivePrices } from "@/lib/pricing";
import { mapShopTicketItems, priceShopTicketItems, SHOP_TICKET_CATALOG_SELECT, type PosCatalogProduct } from "@/lib/shop/pos";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "update");
  const gate = action === "delete" ? await requireApiShopManage() : await requireApiShop();
  if (!gate.ok) return gate.error;
  const supabase = await createServerSupabase();

  if (action === "delete") {
    const { data, error } = await supabase.rpc("delete_shop_receipt", { p_receipt_id: String(body.id || "") });
    if (error) return jsonError("shop.receipts.delete", "Unable to delete this receipt.", 400, error);
    if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to delete this receipt.") }, { status: 400 });
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
    return NextResponse.json({ error: resolved.error || "Unable to price this receipt." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("update_shop_receipt", {
    p_receipt_id: String(body.id || ""),
    p_items: ticket,
    p_customer_name: String(body.customerName || ""),
    p_customer_email: String(body.customerEmail || ""),
    p_customer_phone: String(body.customerPhone || ""),
    p_payment_method: String(body.paymentMethod || "cash"),
    p_cashier_name: String(body.cashierName || ""),
    p_time_taken: String(body.timeTaken || ""),
    p_notes: String(body.notes || ""),
  });
  if (error) return jsonError("shop.receipts.update", "Unable to update this receipt.", 400, error);
  if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to update this receipt.") }, { status: 400 });
  return NextResponse.json(data);
}
