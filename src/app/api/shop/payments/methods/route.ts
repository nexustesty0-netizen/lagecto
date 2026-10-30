import { NextResponse } from "next/server";
import { MARKETPLACE_PAYMENTS_DISABLED_MESSAGE, marketplaceOnlinePaymentsEnabled } from "@/lib/payments/config";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (!marketplaceOnlinePaymentsEnabled()) {
    return NextResponse.json({ error: MARKETPLACE_PAYMENTS_DISABLED_MESSAGE }, { status: 410 });
  }
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const methods = Array.isArray(body.methods) ? body.methods : [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("shop_set_payment_methods", {
    p_shop_id: auth.shop.id,
    p_methods: methods,
  });
  if (error) return NextResponse.json({ error: "Unable to save payment methods." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
