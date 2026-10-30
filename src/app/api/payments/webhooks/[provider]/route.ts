import { NextResponse } from "next/server";
import { MARKETPLACE_PAYMENTS_DISABLED_MESSAGE, marketplaceOnlinePaymentsEnabled } from "@/lib/payments/config";
import { PaymentService } from "@/lib/payments/service";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!marketplaceOnlinePaymentsEnabled()) {
    return NextResponse.json({ error: MARKETPLACE_PAYMENTS_DISABLED_MESSAGE }, { status: 410 });
  }
  const { provider } = await context.params;
  const rawBody = await request.text();
  if (!rawBody) {
    return NextResponse.json({ error: "Empty webhook." }, { status: 400 });
  }
  const result = await PaymentService.handleWebhook(provider, rawBody, request.headers);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  }
  return NextResponse.json({ ok: true });
}
