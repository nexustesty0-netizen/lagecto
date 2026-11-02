import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopOwner } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShopOwner();
  if (!auth.ok) return auth.error;
  const { shop } = auth;

  const body = await request.json().catch(() => ({}));
  const label = String(body.label || "").trim() || null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("start_new_financial_period", {
    p_shop_id: shop.id,
    p_label: label,
  });
  if (error) return NextResponse.json({ error: "Unable to start a new period." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
