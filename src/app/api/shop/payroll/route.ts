import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopFeature } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShopFeature("payroll");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "create");
  const supabase = await createServerSupabase();

  if (action === "status") {
    const { data, error } = await supabase.rpc("set_payroll_status", {
      p_payroll_id: String(body.id || ""),
      p_status: String(body.status || ""),
    });
    if (error) return NextResponse.json({ error: "Unable to update payroll." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.rpc("create_payroll_record", {
    p_employee_id: String(body.employeeId || ""),
    p_period_start: body.periodStart || null,
    p_period_end: body.periodEnd || null,
    p_deductions: Number(body.deductions || 0),
    p_bonuses: Number(body.bonuses || 0),
    p_notes: body.notes || null,
  });
  if (error) return NextResponse.json({ error: "Unable to create payroll." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
