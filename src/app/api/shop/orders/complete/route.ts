import { NextResponse } from "next/server";
import { jsonError, publicRpcMessage } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json();
  const orderId = String(body.orderId || "");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("complete_shop_order", {
    p_order_id: orderId,
  });
  if (error) return jsonError("shop.orders.complete", "Unable to complete this order.", 400, error);
  if (data?.ok === false) {
    return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to complete this order.") }, { status: 400 });
  }
  return NextResponse.json(data);
}
