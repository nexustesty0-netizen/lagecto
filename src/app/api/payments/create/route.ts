import { NextResponse } from "next/server";
import { MARKETPLACE_PAYMENTS_DISABLED_MESSAGE, marketplaceOnlinePaymentsEnabled } from "@/lib/payments/config";
import { requireApiProfile } from "@/lib/auth/session";
import { PaymentService, newIdempotencyKey } from "@/lib/payments/service";
import { normalizePaymentMethod } from "@/lib/payments/methods";

export async function POST(request: Request) {
  if (!marketplaceOnlinePaymentsEnabled()) {
    return NextResponse.json({ error: MARKETPLACE_PAYMENTS_DISABLED_MESSAGE }, { status: 410 });
  }
  const auth = await requireApiProfile("customer");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const method = normalizePaymentMethod(body.paymentMethod);
  if (!method) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 });
  }
  const result = await PaymentService.createPayment({
    orderId: String(body.orderId || ""),
    method,
    customerPhone: body.ecocashPhone || null,
    idempotencyKey: body.retry ? newIdempotencyKey(String(body.orderId || ""), method) : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
