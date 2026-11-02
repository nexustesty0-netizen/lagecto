import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadShopForProfile, requireApiProfile } from "@/lib/auth/session";
import { notifyUser } from "@/lib/notify.server";

export async function POST(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const profile = auth.profile;
  const body = await request.json();
  const receiptId = String(body.receiptId || "");
  const supabase = await createServerSupabase();
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, receipt_number, customer_id, shop_id, total")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt?.customer_id) {
    return NextResponse.json({ error: "This receipt has no customer account to send to." }, { status: 400 });
  }
  const packed = await loadShopForProfile(profile);
  const ownsReceipt = receipt.customer_id === profile.id;
  const shopCanSend = Boolean(packed.shop && packed.staffRole && packed.shop.id === receipt.shop_id);
  const isAdmin = profile.role === "admin";
  if (!ownsReceipt && !shopCanSend && !isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  await notifyUser(receipt.customer_id, {
    title: "LaGecto receipt",
    message: `Receipt ${receipt.receipt_number} is ready in your receipts.`,
    type: "receipt",
    referenceId: receipt.id,
    href: `/customer/receipts/${receipt.id}`,
  });
  return NextResponse.json({ ok: true });
}
