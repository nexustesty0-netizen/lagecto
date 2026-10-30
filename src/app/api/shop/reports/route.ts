import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShop } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShop();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("submit_manager_report", {
    p_shop_id: auth.shop.id,
    p_title: String(body.title || ""),
    p_category: String(body.category || "operational"),
    p_body: String(body.body || ""),
  });
  if (error) return NextResponse.json({ error: "Unable to send this report." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
