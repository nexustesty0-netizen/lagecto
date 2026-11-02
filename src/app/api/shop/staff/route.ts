import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopOwner } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShopOwner();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "lookup");
  const supabase = await createServerSupabase();

  if (action === "lookup") {
    const { data, error } = await supabase.rpc("shop_lookup_staff_candidate", {
      p_email: String(body.email || ""),
      p_username: String(body.username || ""),
    });
    if (error) return NextResponse.json({ error: "Unable to look up this person." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "assign") {
    const { data, error } = await supabase.rpc("shop_assign_staff", {
      p_email: String(body.email || ""),
      p_username: String(body.username || ""),
      p_role: String(body.role || "cashier"),
    });
    if (error) return NextResponse.json({ error: "Unable to assign this person." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "remove") {
    const { data, error } = await supabase.rpc("shop_unassign_staff", {
      p_user_id: String(body.userId || ""),
    });
    if (error) return NextResponse.json({ error: "Unable to remove this person." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
