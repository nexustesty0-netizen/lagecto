import { NextResponse } from "next/server";
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
  if (error) return NextResponse.json({ error: error.message || "Unable to complete this order." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error || "Unable to complete this order." }, { status: 400 });
  return NextResponse.json(data);
}
