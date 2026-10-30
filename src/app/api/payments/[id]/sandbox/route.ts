import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";
import { MARKETPLACE_PAYMENTS_DISABLED_MESSAGE, getPaymentMode, marketplaceOnlinePaymentsEnabled } from "@/lib/payments/config";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!marketplaceOnlinePaymentsEnabled()) {
    return NextResponse.json({ error: MARKETPLACE_PAYMENTS_DISABLED_MESSAGE }, { status: 410 });
  }
  const auth = await requireApiProfile("customer");
  if (!auth.ok) return auth.error;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const outcome = String(body.outcome || "success");

  if (getPaymentMode() === "live") {
    return NextResponse.json({ error: "Sandbox checkout is disabled in live mode." }, { status: 403 });
  }

  const service = createServiceSupabase();
  const { data: payment } = await service.from("payments").select("*").eq("id", id).maybeSingle();
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (payment.customer_id !== auth.profile.id) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (payment.payment_provider !== "sandbox") {
    return NextResponse.json({ error: "This payment is not a sandbox payment." }, { status: 400 });
  }

  if (outcome === "fail") {
    const failed = await service.rpc("fail_payment_attempt", {
      p_payment_id: payment.id,
      p_reason: "Sandbox customer chose a failed test payment",
    });
    if (failed.error) return NextResponse.json({ error: "Unable to fail this test payment." }, { status: 400 });
    return NextResponse.json({ ok: true, status: "failed" });
  }

  const applied = await service.rpc("apply_verified_payment", {
    p_payment_id: payment.id,
    p_provider_transaction_id: payment.provider_transaction_id || `SANDBOX-${payment.id}`,
    p_provider_status: "Paid",
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_masked_instrument: "sandbox",
  });
  if (applied.error || applied.data?.ok === false) {
    return NextResponse.json({ error: applied.data?.error || "Unable to confirm this test payment." }, { status: 400 });
  }
  return NextResponse.json(applied.data);
}
