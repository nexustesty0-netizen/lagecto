import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, shop_id")
    .eq("id", String(body.paymentId || ""))
    .eq("shop_id", auth.shop.id)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  const { data, error } = await supabase.rpc("confirm_cash_payment", { p_payment_id: payment.id });
  if (error) return NextResponse.json({ error: "Unable to confirm this cash payment." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
