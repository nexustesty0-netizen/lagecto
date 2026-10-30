import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST() {
  const auth = await requireApiProfile("customer");
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("evaluate_customer_engagement");
  if (error) return NextResponse.json({ error: "Unable to refresh loyalty." }, { status: 400 });
  return NextResponse.json(data);
}
