import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { MARKETPLACE_PAYMENTS_DISABLED_MESSAGE, marketplaceOnlinePaymentsEnabled } from "@/lib/payments/config";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const { data: shop } = await supabase.from("shops").select("id, status, currency").eq("id", id).maybeSingle();
  if (!shop || shop.status !== "active") {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }
  if (!marketplaceOnlinePaymentsEnabled()) {
    return NextResponse.json({
      shopId: shop.id,
      currency: shop.currency || "USD",
      checkout: "whatsapp",
      methods: [],
      message: MARKETPLACE_PAYMENTS_DISABLED_MESSAGE,
    });
  }
  const { data: methods } = await supabase.rpc("shop_payment_methods", { p_shop_id: id });
  const { data: platform } = await supabase.rpc("platform_payment_methods");
  const enabled = Array.isArray(methods) ? methods : ["cash"];
  const allowed = new Set(Array.isArray(platform) ? platform : enabled);
  return NextResponse.json({
    shopId: shop.id,
    currency: shop.currency || "USD",
    methods: enabled.filter((method: string) => allowed.has(method)),
  });
}
