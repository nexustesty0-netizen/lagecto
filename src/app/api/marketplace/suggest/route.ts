import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

function safeSearch(value?: string) {
  return String(value || "")
    .replace(/[%_,()]/g, " ")
    .trim()
    .slice(0, 80);
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ products: [], shops: [], services: [] });
  const { searchParams } = new URL(request.url);
  const q = safeSearch(searchParams.get("q") || "");
  if (q.length < 2) return NextResponse.json({ products: [], shops: [], services: [] });

  const supabase = await createServerSupabase();
  const [{ data: products }, { data: shops }, { data: services }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, price, image, type, shop_id, shops!inner(id, name, slug, status)")
      .eq("is_available", true)
      .eq("type", "product")
      .eq("shops.status", "active")
      .ilike("name", `%${q}%`)
      .limit(5),
    supabase.from("shops").select("id, name, slug, category").eq("status", "active").ilike("name", `%${q}%`).limit(5),
    supabase
      .from("products")
      .select("id, name, price, shop_id, shops!inner(id, name, slug, status)")
      .eq("is_available", true)
      .eq("type", "service")
      .eq("shops.status", "active")
      .ilike("name", `%${q}%`)
      .limit(5),
  ]);

  return NextResponse.json({
    products: products || [],
    shops: shops || [],
    services: services || [],
  });
}
