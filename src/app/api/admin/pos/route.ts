import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAdminLevel } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiAdminLevel("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items)
    ? body.items.map((item: { name?: string; quantity?: number; unit_price?: number }) => ({
        name: String(item.name || "").trim(),
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
      }))
    : [];
  if (!items.length) {
    return NextResponse.json({ error: "Add at least one line." }, { status: 400 });
  }
  if (
    items.some(
      (item: { name: string; quantity: number; unit_price: number }) =>
        !item.name || !Number.isFinite(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unit_price) || item.unit_price < 0,
    )
  ) {
    return NextResponse.json({ error: "Each line needs a name, a quantity of at least 1, and a valid price." }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_platform_sale", {
    p_items: items,
    p_payment_method: String(body.paymentMethod || "cash"),
    p_customer_name: String(body.customerName || ""),
    p_customer_phone: String(body.customerPhone || ""),
    p_notes: String(body.notes || ""),
  });
  if (error) return NextResponse.json({ error: "Unable to record this payment." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
