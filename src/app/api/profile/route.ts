import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { jsonError } from "@/lib/api-error";
import { validateFullName, validatePhone } from "@/lib/validation";

export async function PATCH(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const phone = String(body.phone || "").trim();
  const address = String(body.address || "").trim().slice(0, 200);
  const nameError = validateFullName(name);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
  if (phone) {
    const phoneError = validatePhone(phone);
    if (phoneError) return NextResponse.json({ error: phoneError }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("users")
    .update({ name, phone: phone || null, address: address || null })
    .eq("id", auth.profile.id);
  if (error) return jsonError("profile.update", "Unable to save profile.", 400, error);
  return NextResponse.json({ ok: true });
}
