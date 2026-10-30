import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiShopFeature } from "@/lib/auth/session";

export async function POST(request: Request) {
  const auth = await requireApiShopFeature("employees");
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "save");
  const supabase = await createServerSupabase();

  if (action === "deactivate") {
    const { data, error } = await supabase.rpc("deactivate_employee", { p_employee_id: String(body.id || "") });
    if (error) return NextResponse.json({ error: "Unable to update this employee." }, { status: 400 });
    if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase.rpc("upsert_employee", {
    p_payload: {
      id: body.id || null,
      shop_id: auth.shop.id,
      name: body.name,
      employee_number: body.employee_number,
      role_title: body.role_title,
      department: body.department,
      employment_type: body.employment_type,
      phone: body.phone,
      email: body.email,
      address: body.address,
      start_date: body.start_date,
      salary: body.salary,
      pay_frequency: body.pay_frequency,
      payment_details: body.payment_details,
      emergency_contact_name: body.emergency_contact_name,
      emergency_contact_phone: body.emergency_contact_phone,
      notes: body.notes,
      photo_url: body.photo_url,
    },
  });
  if (error) return NextResponse.json({ error: "Unable to save this employee." }, { status: 400 });
  if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
  return NextResponse.json(data);
}
