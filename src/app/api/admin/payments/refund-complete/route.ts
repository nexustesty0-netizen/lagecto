import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiProfile("admin");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("record_provider_refund_completed", {
    p_refund_id: String(body.refundId || ""),
    p_provider_refund_id: String(body.providerRefundId || ""),
  });
  if (error) return NextResponse.json({ error: "Unable to record this refund." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
