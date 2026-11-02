import { NextResponse } from "next/server";
import { jsonError, publicRpcMessage } from "@/lib/api-error";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopFeature } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShopFeature("expenses");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "save");
  const supabase = await createServerSupabase();

  if (action === "void") {
    const { data, error } = await supabase.rpc("void_shop_expense", { p_expense_id: String(body.id || "") });
    if (error) return NextResponse.json({ error: "Unable to void this expense." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "delete") {
    const { data, error } = await supabase.rpc("delete_shop_expense", { p_expense_id: String(body.id || "") });
    if (error) return NextResponse.json({ error: "Unable to delete this expense." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  if (action === "clear") {
    const { data, error } = await supabase.rpc("clear_shop_expenses");
    if (error) return jsonError("shop.expenses.clear", "Unable to clear expenses.", 400, error);
    if (data?.ok === false) return NextResponse.json({ error: publicRpcMessage(data.error, "Unable to clear expenses.") }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.rpc("upsert_shop_expense", {
    p_payload: {
      id: body.id || null,
      shop_id: auth.shop.id,
      category: body.category,
      description: body.description,
      amount: body.amount,
      expense_date: body.expense_date,
      payment_method: body.payment_method,
      reference: body.reference,
      client_nonce: body.client_nonce,
    },
  });
  if (error) return NextResponse.json({ error: "Unable to save this expense." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
