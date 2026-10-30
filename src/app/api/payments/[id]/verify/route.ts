import { NextResponse } from "next/server";
import { MARKETPLACE_PAYMENTS_DISABLED_MESSAGE, marketplaceOnlinePaymentsEnabled } from "@/lib/payments/config";
import { requireApiProfile } from "@/lib/auth/session";
import { PaymentService } from "@/lib/payments/service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!marketplaceOnlinePaymentsEnabled()) {
    return NextResponse.json({ error: MARKETPLACE_PAYMENTS_DISABLED_MESSAGE }, { status: 410 });
  }
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const { id } = await context.params;
  const payment = await PaymentService.getPaymentStatus(id);
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  const result = await PaymentService.verifyPayment(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
