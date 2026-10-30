import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile, requireApiShop } from "@/lib/auth/session";

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
  if (profile.role === "customer" && receipt.customer_id !== profile.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (profile.role === "shop_owner") {
    const shopAuth = await requireApiShop();
    if (!shopAuth.ok) return shopAuth.error;
    if (receipt.shop_id !== shopAuth.shop.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }
  const { error } = await supabase.from("notifications").insert({
    user_id: receipt.customer_id,
    title: "LaGecto receipt",
    message: `Receipt ${receipt.receipt_number} for $${Number(receipt.total).toFixed(2)} is ready in your receipts.`,
    type: "receipt",
    reference_id: receipt.id,
  });
  if (error) return NextResponse.json({ error: "Unable to send this receipt." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
