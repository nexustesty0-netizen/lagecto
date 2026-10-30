import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, whatsapp_number, phone, status")
    .eq("id", id)
    .maybeSingle();
  if (!shop || shop.status !== "active") {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }
  return NextResponse.json({
    shopId: shop.id,
    name: shop.name,
    whatsapp: shop.whatsapp_number || null,
    phone: shop.phone || null,
  });
}
