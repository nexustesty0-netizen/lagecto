import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data: refund } = await supabase
    .from("payment_refunds")
    .select("id, shop_id")
    .eq("id", String(body.refundId || ""))
    .eq("shop_id", auth.shop.id)
    .maybeSingle();
  if (!refund) return NextResponse.json({ error: "Refund not found." }, { status: 404 });
  const { data, error } = await supabase.rpc("complete_cash_refund", { p_refund_id: refund.id });
  if (error) return NextResponse.json({ error: "Unable to complete this cash refund." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
