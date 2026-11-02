import { NextResponse } from "next/server";
import { requireApiShopManage } from "@/lib/auth/session";
import { PaymentService } from "@/lib/payments/service";

export async function POST(request: Request) {
  const auth = await requireApiShopManage();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const result = await PaymentService.refundPayment({
    paymentId: String(body.paymentId || ""),
    amount: Number(body.amount || 0),
    reason: String(body.reason || ""),
    kind: body.kind === "cash" ? "cash" : "provider",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
