import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiAdminLevel, requireApiProfile } from "@/lib/auth/session";
import { getPaymentPublicConfig } from "@/lib/payments/config";

export async function GET() {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth.error;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("platform_payment_config").select("enabled_methods, notes, updated_at").eq("id", 1).maybeSingle();
  return NextResponse.json({
    ...getPaymentPublicConfig(),
    enabledMethods: data?.enabled_methods || ["visa", "mastercard", "ecocash", "cash"],
    notes: data?.notes || "",
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdminLevel("super_admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_set_platform_payment_methods", {
    p_methods: Array.isArray(body.methods) ? body.methods : [],
  });
  if (error) return NextResponse.json({ error: "Unable to save platform payment methods." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  if (typeof body.notes === "string") {
    await supabase.from("platform_payment_config").update({ notes: body.notes.slice(0, 500) }).eq("id", 1);
  }
  return NextResponse.json({ ...data, config: getPaymentPublicConfig() });
}
